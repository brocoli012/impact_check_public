/**
 * @module tests/unit/indexing/ts-event-parsing.test
 * @description TypeScript 이벤트 패턴 감지 테스트 (Phase C: TASK-106)
 */

import { TypeScriptParser } from '@/core/indexing/parsers/typescript-parser';

describe('TypeScript Event Pattern Detection', () => {
  let parser: TypeScriptParser;

  beforeAll(() => {
    parser = new TypeScriptParser();
  });

  // ============================================================
  // EventEmitter patterns
  // ============================================================

  describe('EventEmitter patterns', () => {
    it('should detect .emit() as publisher', () => {
      const content = `
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

function sendNotification() {
  emitter.emit('user-registered', { userId: 123 });
}
`;
      const events = parser.parseEventPatterns('src/events.ts', content);
      expect(events.length).toBeGreaterThanOrEqual(1);
      const pub = events.find(e => e.name === 'user-registered' && e.role === 'publisher');
      expect(pub).toBeDefined();
      expect(pub!.type).toBe('node-event');
      expect(pub!.handler).toBe('sendNotification');
    });

    it('should detect .on() as subscriber', () => {
      const content = `
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

function setupListeners() {
  emitter.on('user-registered', (data) => {
    console.log(data);
  });
}
`;
      const events = parser.parseEventPatterns('src/listeners.ts', content);
      const sub = events.find(e => e.name === 'user-registered' && e.role === 'subscriber');
      expect(sub).toBeDefined();
      expect(sub!.type).toBe('node-event');
    });

    it('should detect .once() as subscriber', () => {
      const content = `
const bus = new EventBus();
bus.once('shutdown', () => process.exit(0));
`;
      const events = parser.parseEventPatterns('src/app.ts', content);
      const sub = events.find(e => e.name === 'shutdown' && e.role === 'subscriber');
      expect(sub).toBeDefined();
    });

    it('should detect .addListener() as subscriber', () => {
      const content = `
server.addListener('connection', (socket) => {
  console.log('new connection');
});
`;
      const events = parser.parseEventPatterns('src/server.ts', content);
      const sub = events.find(e => e.name === 'connection' && e.role === 'subscriber');
      expect(sub).toBeDefined();
    });
  });

  // ============================================================
  // Custom pub/sub patterns
  // ============================================================

  describe('Custom pub/sub patterns', () => {
    it('should detect .publish() as publisher', () => {
      const content = `
function notifyOrderCreated(order) {
  messageBroker.publish('order-created', order);
}
`;
      const events = parser.parseEventPatterns('src/publisher.ts', content);
      const pub = events.find(e => e.name === 'order-created' && e.role === 'publisher');
      expect(pub).toBeDefined();
      expect(pub!.type).toBe('custom');
      expect(pub!.topic).toBe('order-created');
    });

    it('should detect .dispatch() as publisher', () => {
      const content = `
store.dispatch('INCREMENT', { value: 1 });
`;
      const events = parser.parseEventPatterns('src/store.ts', content);
      const pub = events.find(e => e.name === 'INCREMENT' && e.role === 'publisher');
      expect(pub).toBeDefined();
    });

    it('should detect .trigger() as publisher', () => {
      const content = `
eventBus.trigger('notification-sent', payload);
`;
      const events = parser.parseEventPatterns('src/bus.ts', content);
      const pub = events.find(e => e.name === 'notification-sent' && e.role === 'publisher');
      expect(pub).toBeDefined();
    });

    it('should detect .subscribe() with string arg as subscriber', () => {
      const content = `
messageBroker.subscribe('order-created', handleOrder);
`;
      const events = parser.parseEventPatterns('src/subscriber.ts', content);
      const sub = events.find(e => e.name === 'order-created' && e.role === 'subscriber');
      expect(sub).toBeDefined();
    });

    it('should detect .listen() as subscriber', () => {
      const content = `
function setupHandlers() {
  queue.listen('payment-completed', processPayment);
}
`;
      const events = parser.parseEventPatterns('src/handler.ts', content);
      const sub = events.find(e => e.name === 'payment-completed' && e.role === 'subscriber');
      expect(sub).toBeDefined();
    });
  });

  // ============================================================
  // Integration with parse()
  // ============================================================

  describe('Integration with parse()', () => {
    it('should collect events during parse()', async () => {
      const content = `
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

export function publishOrder(orderId: string) {
  emitter.emit('order-created', { orderId });
}

export function listenForOrders() {
  emitter.on('order-created', (data) => {
    console.log('Order received:', data);
  });
}
`;
      const result = await parser.parse('src/order-events.ts', content);
      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThanOrEqual(2);

      const pub = result.events!.find(e => e.role === 'publisher');
      expect(pub).toBeDefined();
      expect(pub!.name).toBe('order-created');

      const sub = result.events!.find(e => e.role === 'subscriber');
      expect(sub).toBeDefined();
      expect(sub!.name).toBe('order-created');
    });

    it('should not detect events in comments', () => {
      const content = `
// emitter.emit('commented-out-event', data);
/* bus.on('block-commented', handler); */
const x = 42;
`;
      const events = parser.parseEventPatterns('src/commented.ts', content);
      expect(events.length).toBe(0);
    });

    it('should return empty array for files without events', () => {
      const content = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
      const events = parser.parseEventPatterns('src/utils.ts', content);
      expect(events).toEqual([]);
    });
  });

  // ============================================================
  // Multiple events in one file
  // ============================================================

  describe('Multiple events in one file', () => {
    it('should detect multiple different events', () => {
      const content = `
import { EventEmitter } from 'events';
const bus = new EventEmitter();

function processOrder() {
  bus.emit('order-validated', { status: 'ok' });
  bus.emit('payment-initiated', { amount: 100 });
}

function setupListeners() {
  bus.on('order-validated', handleValidation);
  bus.on('payment-initiated', handlePayment);
}
`;
      const events = parser.parseEventPatterns('src/multi-events.ts', content);
      expect(events.length).toBeGreaterThanOrEqual(4);

      const publishers = events.filter(e => e.role === 'publisher');
      const subscribers = events.filter(e => e.role === 'subscriber');
      expect(publishers.length).toBeGreaterThanOrEqual(2);
      expect(subscribers.length).toBeGreaterThanOrEqual(2);
    });
  });
});
