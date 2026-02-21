/**
 * REQ-013 Phase A 테스트 - 엔티티 모델 / 이벤트 파싱
 */
import {
  parseAnnotationAttribute,
  camelToSnakeCase,
  stripStringsAndComments,
} from '../../../src/core/indexing/parsers/jvm-parser-utils';
import { JavaParser } from '../../../src/core/indexing/parsers/java-parser';
import { KotlinParser } from '../../../src/core/indexing/parsers/kotlin-parser';

// ============================================================
// camelToSnakeCase 테스트
// ============================================================

describe('camelToSnakeCase', () => {
  it('should convert PascalCase to snake_case', () => {
    expect(camelToSnakeCase('OrderItem')).toBe('order_item');
  });

  it('should convert camelCase to snake_case', () => {
    expect(camelToSnakeCase('deliveryFee')).toBe('delivery_fee');
  });

  it('should handle single word', () => {
    expect(camelToSnakeCase('Order')).toBe('order');
  });

  it('should handle consecutive uppercase', () => {
    expect(camelToSnakeCase('HTMLParser')).toBe('html_parser');
  });

  it('should handle empty string', () => {
    expect(camelToSnakeCase('')).toBe('');
  });

  it('should handle already snake_case', () => {
    expect(camelToSnakeCase('order_item')).toBe('order_item');
  });
});

// ============================================================
// parseAnnotationAttribute 테스트
// ============================================================

describe('parseAnnotationAttribute', () => {
  it('should extract name attribute from @Table(name = "orders")', () => {
    const content = '@Table(name = "orders")\npublic class Order {}';
    const { processed } = stripStringsAndComments(content);
    expect(parseAnnotationAttribute(processed, content, 'Table', 'name')).toBe('orders');
  });

  it('should extract value from @Table("orders") as name attribute', () => {
    const content = '@Table("orders")\npublic class Order {}';
    const { processed } = stripStringsAndComments(content);
    expect(parseAnnotationAttribute(processed, content, 'Table', 'name')).toBe('orders');
  });

  it('should return null when annotation not found', () => {
    const content = 'public class Order {}';
    const { processed } = stripStringsAndComments(content);
    expect(parseAnnotationAttribute(processed, content, 'Table', 'name')).toBeNull();
  });

  it('should extract topics from @KafkaListener(topics = "order-events")', () => {
    const content = '@KafkaListener(topics = "order-events")\npublic void handle() {}';
    const { processed } = stripStringsAndComments(content);
    expect(parseAnnotationAttribute(processed, content, 'KafkaListener', 'topics')).toBe('order-events');
  });

  it('should extract schema from @Table(name = "orders", schema = "ecommerce")', () => {
    const content = '@Table(name = "orders", schema = "ecommerce")\npublic class Order {}';
    const { processed } = stripStringsAndComments(content);
    expect(parseAnnotationAttribute(processed, content, 'Table', 'schema')).toBe('ecommerce');
  });
});

// ============================================================
// JavaParser 엔티티/이벤트 테스트
// ============================================================

describe('JavaParser entity/event parsing', () => {
  const parser = new JavaParser();

  describe('parseEntityModels', () => {
    it('should detect @Entity class and extract tableName from @Table', async () => {
      const code = `
package com.example;

import javax.persistence.*;

@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue
    private Long id;

    @Column(name = "order_number")
    private String orderNumber;

    @ManyToOne
    private Customer customer;
}
`;
      const result = await parser.parse('Order.java', code);
      expect(result.models).toBeDefined();
      expect(result.models!.length).toBeGreaterThanOrEqual(1);

      const model = result.models![0];
      expect(model.name).toBe('Order');
      expect(model.tableName).toBe('orders');
      expect(model.type).toBe('entity');
      expect(model.annotations).toContain('@Entity');
    });

    it('should use snake_case class name when @Table has no name', async () => {
      const code = `
package com.example;

import javax.persistence.*;

@Entity
public class OrderItem {
    @Id
    private Long id;
}
`;
      const result = await parser.parse('OrderItem.java', code);
      expect(result.models).toBeDefined();
      expect(result.models!.length).toBeGreaterThanOrEqual(1);

      const model = result.models![0];
      expect(model.tableName).toBe('order_item');
    });
  });

  describe('parseEventPatterns', () => {
    it('should detect @KafkaListener subscriber', async () => {
      const code = `
package com.example;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class OrderEventHandler {
    @KafkaListener(topics = "order-created")
    public void handleOrderCreated(String message) {
        // handle
    }
}
`;
      const result = await parser.parse('OrderEventHandler.java', code);
      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThanOrEqual(1);

      const event = result.events!.find(e => e.role === 'subscriber' && e.type === 'kafka');
      expect(event).toBeDefined();
      expect(event!.topic).toBe('order-created');
    });

    it('should detect @EventListener subscriber', async () => {
      const code = `
package com.example;

import org.springframework.context.event.EventListener;

public class NotificationService {
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        // handle
    }
}
`;
      const result = await parser.parse('NotificationService.java', code);
      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThanOrEqual(1);

      const event = result.events!.find(e => e.role === 'subscriber' && e.type === 'spring-event');
      expect(event).toBeDefined();
    });

    it('should detect KafkaTemplate.send publisher', async () => {
      const code = `
package com.example;

public class OrderService {
    private final KafkaTemplate<String, String> kafkaTemplate;

    public void createOrder(Order order) {
        kafkaTemplate.send("order-events", order.toString());
    }
}
`;
      const result = await parser.parse('OrderService.java', code);
      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThanOrEqual(1);

      const event = result.events!.find(e => e.role === 'publisher' && e.type === 'kafka');
      expect(event).toBeDefined();
    });
  });
});

// ============================================================
// KotlinParser 엔티티/이벤트 테스트
// ============================================================

describe('KotlinParser entity/event parsing', () => {
  const parser = new KotlinParser();

  describe('parseEntityModels', () => {
    it('should detect @Entity class in Kotlin', async () => {
      const code = `
package com.example

import javax.persistence.*

@Entity
@Table(name = "products")
class Product(
    @Id @GeneratedValue
    val id: Long = 0,
    val name: String,
    val price: Double,
    @ManyToOne
    val category: Category? = null
)
`;
      const result = await parser.parse('Product.kt', code);
      expect(result.models).toBeDefined();
      expect(result.models!.length).toBeGreaterThanOrEqual(1);

      const model = result.models![0];
      expect(model.name).toBe('Product');
      expect(model.tableName).toBe('products');
      expect(model.type).toBe('entity');
    });
  });

  describe('parseEventPatterns', () => {
    it('should detect @KafkaListener subscriber in Kotlin', async () => {
      const code = `
package com.example

import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Service

@Service
class OrderEventHandler {
    @KafkaListener(topics = "order-created")
    fun handleOrderCreated(message: String) {
        // handle
    }
}
`;
      const result = await parser.parse('OrderEventHandler.kt', code);
      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThanOrEqual(1);

      const event = result.events!.find(e => e.role === 'subscriber' && e.type === 'kafka');
      expect(event).toBeDefined();
      expect(event!.topic).toBe('order-created');
    });
  });
});
