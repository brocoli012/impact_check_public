/**
 * JavaParser 단위 테스트
 * Regex 기반 Java 파서의 정확성 검증
 *
 * TASK-066: 생성자 주입 regex 오탐 수정 테스트
 */
import * as fs from 'fs';
import * as path from 'path';
import { JavaParser } from '../../../src/core/indexing/parsers/java-parser';

const FIXTURES_DIR = path.join(__dirname, '../../fixtures/sample-spring-project/src/main/java/com/example/order');

describe('JavaParser (regex)', () => {
  let parser: JavaParser;

  beforeAll(() => {
    parser = new JavaParser();
  });

  // ================================================================
  // TASK-066: 생성자 주입 regex 오탐 수정 검증
  // ================================================================

  describe('TASK-066: constructor DI false positive fix', () => {

    it('should detect constructor injection only when method name matches class name', async () => {
      const content = `
package com.example;

import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public List<OrderResponse> findAll() {
        return orderRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public OrderResponse create(OrderRequest request) {
        Order order = new Order();
        return toResponse(orderRepository.save(order));
    }

    private OrderResponse toResponse(Order order) {
        return new OrderResponse(order.getId());
    }
}
`;
      const result = await parser.parse('OrderService.java', content);

      // 생성자 주입으로 감지된 항목
      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      // OrderRepository만 생성자 주입으로 감지되어야 함
      expect(constructorDI).toHaveLength(1);
      expect(constructorDI[0].source).toBe('OrderRepository');
    });

    it('should NOT detect normal methods as constructor injection', async () => {
      const content = `
package com.example;

public class UserService {

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public UserService(UserRepository userRepository, NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public UserResponse getUser(Long id) {
        return userRepository.findById(id);
    }

    public UserResponse createUser(UserRequest request) {
        return userRepository.save(request);
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public List<UserResponse> searchUsers(String query, int limit) {
        return userRepository.search(query, limit);
    }
}
`;
      const result = await parser.parse('UserService.java', content);

      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      // UserRepository와 NotificationService만 생성자 주입으로 감지
      expect(constructorDI).toHaveLength(2);
      const diSources = constructorDI.map(i => i.source).sort();
      expect(diSources).toEqual(['NotificationService', 'UserRepository']);

      // getUser, createUser, deleteUser, searchUsers의 파라미터가 DI로 잡히면 안 됨
      const falsePositives = constructorDI.filter(i =>
        ['UserResponse', 'UserRequest', 'List'].includes(i.source)
      );
      expect(falsePositives).toHaveLength(0);
    });

    it('should not produce constructor-injection when class has no constructor', async () => {
      const content = `
package com.example;

public class UtilClass {

    public static String formatDate(String date) {
        return date.trim();
    }

    public static int calculate(int a, int b) {
        return a + b;
    }
}
`;
      const result = await parser.parse('UtilClass.java', content);

      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      expect(constructorDI).toHaveLength(0);
    });

    it('should still detect @RequiredArgsConstructor DI pattern', async () => {
      const content = `
package com.example;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class PaymentService {

    private final PaymentGateway paymentGateway;
    private final OrderRepository orderRepository;
    private final String apiKey;

    public PaymentResponse processPayment(PaymentRequest request) {
        return paymentGateway.charge(request);
    }
}
`;
      const result = await parser.parse('PaymentService.java', content);

      const lombokDI = result.imports.filter(i =>
        i.specifiers.includes('@RequiredArgsConstructor')
      );

      // PaymentGateway와 OrderRepository만 DI (String apiKey는 제외됨)
      expect(lombokDI).toHaveLength(2);
      const diSources = lombokDI.map(i => i.source).sort();
      expect(diSources).toEqual(['OrderRepository', 'PaymentGateway']);
    });

    it('should still detect @Autowired field injection', async () => {
      const content = `
package com.example;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class EventHandler {

    @Autowired
    private EventPublisher eventPublisher;

    @Autowired
    private EventRepository eventRepository;

    public void handleEvent(EventData data) {
        eventPublisher.publish(data);
    }
}
`;
      const result = await parser.parse('EventHandler.java', content);

      const autowiredDI = result.imports.filter(i =>
        i.specifiers.some(s => s.startsWith('@Autowired'))
      );

      expect(autowiredDI).toHaveLength(2);
      const diSources = autowiredDI.map(i => i.source).sort();
      expect(diSources).toEqual(['EventPublisher', 'EventRepository']);
    });
  });

  // ================================================================
  // Fixture-based tests (OrderController, OrderService)
  // ================================================================

  describe('OrderController.java (fixture)', () => {
    let result: Awaited<ReturnType<JavaParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'OrderController.java');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('OrderController.java', content);
    });

    it('should detect constructor DI for OrderService only', () => {
      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      expect(constructorDI).toHaveLength(1);
      expect(constructorDI[0].source).toBe('OrderService');
    });

    it('should NOT detect method parameters as constructor DI', () => {
      // getOrder(Long id), createOrder(OrderRequest request) 등의
      // 파라미터 타입이 constructor-injection으로 잡히면 안 됨
      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      const falsePositives = constructorDI.filter(i =>
        ['ResponseEntity', 'OrderRequest', 'OrderResponse'].includes(i.source)
      );
      expect(falsePositives).toHaveLength(0);
    });
  });

  describe('OrderService.java (fixture)', () => {
    let result: Awaited<ReturnType<JavaParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'OrderService.java');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('OrderService.java', content);
    });

    it('should detect constructor DI for OrderRepository only', () => {
      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      expect(constructorDI).toHaveLength(1);
      expect(constructorDI[0].source).toBe('OrderRepository');
    });

    it('should NOT detect findAll, create, update, delete method params as DI', () => {
      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      const falsePositives = constructorDI.filter(i =>
        ['OrderRequest', 'OrderResponse', 'Order', 'List'].includes(i.source)
      );
      expect(falsePositives).toHaveLength(0);
    });
  });

  describe('Order.java - Entity with no DI (fixture)', () => {
    let result: Awaited<ReturnType<JavaParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'Order.java');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('Order.java', content);
    });

    it('should NOT detect any constructor DI for entity class', () => {
      const constructorDI = result.imports.filter(i =>
        i.specifiers.includes('constructor-injection')
      );

      // Order entity has no explicit constructor with DI params
      // Getter/setter params (Long id, String productName, etc.) should NOT be detected
      expect(constructorDI).toHaveLength(0);
    });
  });

  // ================================================================
  // REQ-012 TASK-078: Java 메서드 어노테이션 수집 테스트
  // ================================================================

  describe('TASK-078: Java method annotation collection', () => {

    it('should collect @Transactional annotation on method', async () => {
      const content = `
package com.example;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional
    public Order createOrder(OrderRequest request) {
        Order order = new Order();
        return orderRepository.save(order);
    }

    public Order getOrder(Long id) {
        return orderRepository.findById(id);
    }
}
`;
      const result = await parser.parse('OrderService.java', content);

      const createOrderFunc = result.functions.find(f => f.name === 'createOrder');
      expect(createOrderFunc).toBeDefined();
      expect(createOrderFunc!.annotations).toBeDefined();
      expect(createOrderFunc!.annotations!.some(a => a.includes('@Transactional'))).toBe(true);

      const getOrderFunc = result.functions.find(f => f.name === 'getOrder');
      expect(getOrderFunc).toBeDefined();
      // No annotations expected on getOrder
      expect(getOrderFunc!.annotations === undefined || getOrderFunc!.annotations!.length === 0).toBe(true);
    });

    it('should collect @Cacheable with parameters', async () => {
      const content = `
package com.example;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class ProductService {

    @Cacheable(value = "products")
    public Product getProduct(Long id) {
        return productRepository.findById(id);
    }
}
`;
      const result = await parser.parse('ProductService.java', content);

      const getProductFunc = result.functions.find(f => f.name === 'getProduct');
      expect(getProductFunc).toBeDefined();
      expect(getProductFunc!.annotations).toBeDefined();
      expect(getProductFunc!.annotations!.length).toBeGreaterThanOrEqual(1);
      // Should contain @Cacheable with parameter
      const cacheAnno = getProductFunc!.annotations!.find(a => a.includes('@Cacheable'));
      expect(cacheAnno).toBeDefined();
    });

    it('should collect multiple annotations on a single method', async () => {
      const content = `
package com.example;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;

@Service
public class CartService {

    @Transactional
    @CacheEvict(value = "carts")
    public void clearCart(Long userId) {
        cartRepository.deleteByUserId(userId);
    }
}
`;
      const result = await parser.parse('CartService.java', content);

      const clearCartFunc = result.functions.find(f => f.name === 'clearCart');
      expect(clearCartFunc).toBeDefined();
      expect(clearCartFunc!.annotations).toBeDefined();
      expect(clearCartFunc!.annotations!.length).toBeGreaterThanOrEqual(2);
      expect(clearCartFunc!.annotations!.some(a => a.includes('@Transactional'))).toBe(true);
      expect(clearCartFunc!.annotations!.some(a => a.includes('@CacheEvict'))).toBe(true);
    });

    it('should not produce annotations for method without any annotations', async () => {
      const content = `
package com.example;

public class UtilClass {

    public static String formatDate(String date) {
        return date.trim();
    }
}
`;
      const result = await parser.parse('UtilClass.java', content);

      const formatDateFunc = result.functions.find(f => f.name === 'formatDate');
      expect(formatDateFunc).toBeDefined();
      // annotations should be undefined or empty
      expect(
        formatDateFunc!.annotations === undefined || formatDateFunc!.annotations!.length === 0
      ).toBe(true);
    });

    it('should collect @Scheduled, @Retryable, @PreAuthorize annotations', async () => {
      const content = `
package com.example;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.retry.annotation.Retryable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

@Service
public class TaskService {

    @Scheduled(cron = "0 0 * * * *")
    public void cleanupExpired() {
        // cleanup logic
    }

    @Retryable(maxAttempts = 3)
    public void callExternalApi() {
        // external call
    }

    @PreAuthorize("hasRole('ADMIN')")
    public void adminAction() {
        // admin only
    }
}
`;
      const result = await parser.parse('TaskService.java', content);

      const cleanupFunc = result.functions.find(f => f.name === 'cleanupExpired');
      expect(cleanupFunc).toBeDefined();
      expect(cleanupFunc!.annotations).toBeDefined();
      expect(cleanupFunc!.annotations!.some(a => a.includes('@Scheduled'))).toBe(true);

      const retryFunc = result.functions.find(f => f.name === 'callExternalApi');
      expect(retryFunc).toBeDefined();
      expect(retryFunc!.annotations).toBeDefined();
      expect(retryFunc!.annotations!.some(a => a.includes('@Retryable'))).toBe(true);

      const adminFunc = result.functions.find(f => f.name === 'adminAction');
      expect(adminFunc).toBeDefined();
      expect(adminFunc!.annotations).toBeDefined();
      expect(adminFunc!.annotations!.some(a => a.includes('@PreAuthorize'))).toBe(true);
    });
  });
});
