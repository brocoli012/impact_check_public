/**
 * KotlinParser (regex) 단위 테스트
 * REQ-012 TASK-078: Kotlin 메서드 어노테이션 수집 테스트
 */
import { KotlinParser } from '../../../src/core/indexing/parsers/kotlin-parser';

describe('KotlinParser (regex)', () => {
  let parser: KotlinParser;

  beforeAll(() => {
    parser = new KotlinParser();
  });

  // ================================================================
  // REQ-012 TASK-078: Kotlin 메서드 어노테이션 수집 테스트
  // ================================================================

  describe('TASK-078: Kotlin method annotation collection', () => {

    it('should collect @Transactional annotation on fun', async () => {
      const content = `
package com.example

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class OrderService(
    private val orderRepository: OrderRepository
) {

    @Transactional
    fun createOrder(request: OrderRequest): Order {
        val order = Order()
        return orderRepository.save(order)
    }

    fun getOrder(id: Long): Order {
        return orderRepository.findById(id)
    }
}
`;
      const result = await parser.parse('OrderService.kt', content);

      const createOrderFunc = result.functions.find(f => f.name === 'createOrder');
      expect(createOrderFunc).toBeDefined();
      expect(createOrderFunc!.annotations).toBeDefined();
      expect(createOrderFunc!.annotations!.some(a => a.includes('@Transactional'))).toBe(true);

      const getOrderFunc = result.functions.find(f => f.name === 'getOrder');
      expect(getOrderFunc).toBeDefined();
      // No annotations on getOrder
      expect(
        getOrderFunc!.annotations === undefined || getOrderFunc!.annotations!.length === 0
      ).toBe(true);
    });

    it('should collect @Cacheable with parameters on Kotlin fun', async () => {
      const content = `
package com.example

import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

@Service
class ProductService(
    private val productRepository: ProductRepository
) {

    @Cacheable(value = ["products"])
    fun getProduct(id: Long): Product {
        return productRepository.findById(id)
    }
}
`;
      const result = await parser.parse('ProductService.kt', content);

      const getProductFunc = result.functions.find(f => f.name === 'getProduct');
      expect(getProductFunc).toBeDefined();
      expect(getProductFunc!.annotations).toBeDefined();
      expect(getProductFunc!.annotations!.some(a => a.includes('@Cacheable'))).toBe(true);
    });

    it('should collect multiple annotations on a single Kotlin fun', async () => {
      const content = `
package com.example

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.cache.annotation.CacheEvict

@Service
class CartService(
    private val cartRepository: CartRepository
) {

    @Transactional
    @CacheEvict(value = ["carts"])
    fun clearCart(userId: Long) {
        cartRepository.deleteByUserId(userId)
    }
}
`;
      const result = await parser.parse('CartService.kt', content);

      const clearCartFunc = result.functions.find(f => f.name === 'clearCart');
      expect(clearCartFunc).toBeDefined();
      expect(clearCartFunc!.annotations).toBeDefined();
      expect(clearCartFunc!.annotations!.length).toBeGreaterThanOrEqual(2);
      expect(clearCartFunc!.annotations!.some(a => a.includes('@Transactional'))).toBe(true);
      expect(clearCartFunc!.annotations!.some(a => a.includes('@CacheEvict'))).toBe(true);
    });

    it('should not produce annotations for fun without any annotations', async () => {
      const content = `
package com.example

class UtilClass {

    fun formatDate(date: String): String {
        return date.trim()
    }
}
`;
      const result = await parser.parse('UtilClass.kt', content);

      const formatDateFunc = result.functions.find(f => f.name === 'formatDate');
      expect(formatDateFunc).toBeDefined();
      expect(
        formatDateFunc!.annotations === undefined || formatDateFunc!.annotations!.length === 0
      ).toBe(true);
    });

    it('should collect @Scheduled and @EventListener annotations on Kotlin fun', async () => {
      const content = `
package com.example

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class EventProcessor {

    @Scheduled(fixedDelay = 60000)
    fun processQueue() {
        // process queue items
    }

    @EventListener
    fun onOrderCreated(event: OrderCreatedEvent) {
        // handle event
    }
}
`;
      const result = await parser.parse('EventProcessor.kt', content);

      const processQueueFunc = result.functions.find(f => f.name === 'processQueue');
      expect(processQueueFunc).toBeDefined();
      expect(processQueueFunc!.annotations).toBeDefined();
      expect(processQueueFunc!.annotations!.some(a => a.includes('@Scheduled'))).toBe(true);

      const onOrderFunc = result.functions.find(f => f.name === 'onOrderCreated');
      expect(onOrderFunc).toBeDefined();
      expect(onOrderFunc!.annotations).toBeDefined();
      expect(onOrderFunc!.annotations!.some(a => a.includes('@EventListener'))).toBe(true);
    });

    it('should handle suspend fun with annotations', async () => {
      const content = `
package com.example

import org.springframework.transaction.annotation.Transactional
import org.springframework.stereotype.Service

@Service
class AsyncService {

    @Transactional
    suspend fun processAsync(data: String): Result {
        return doWork(data)
    }
}
`;
      const result = await parser.parse('AsyncService.kt', content);

      const processFunc = result.functions.find(f => f.name === 'processAsync');
      expect(processFunc).toBeDefined();
      expect(processFunc!.isAsync).toBe(true);
      expect(processFunc!.annotations).toBeDefined();
      expect(processFunc!.annotations!.some(a => a.includes('@Transactional'))).toBe(true);
    });
  });
});
