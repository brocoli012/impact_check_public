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
});
