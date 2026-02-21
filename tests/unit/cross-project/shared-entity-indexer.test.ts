/**
 * REQ-013 Phase B 테스트 - SharedEntityIndexer, ReverseCommand, detectLinks 확장
 */
import { SharedEntityIndexer } from '../../../src/core/cross-project/shared-entity-indexer';
import { SharedEntityIndex } from '../../../src/core/cross-project/shared-entity-types';
import { CodeIndex } from '../../../src/types/index';

// ============================================================
// 테스트 헬퍼 - 최소 CodeIndex 생성
// ============================================================

function createMinimalCodeIndex(overrides?: Partial<CodeIndex>): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: { name: 'test', path: '/test', techStack: [], packageManager: 'npm' },
      stats: { totalFiles: 0, screens: 0, components: 0, apiEndpoints: 0, models: 0, modules: 0 },
    },
    files: [],
    screens: [],
    components: [],
    apis: [],
    models: [],
    events: [],
    policies: [],
    dependencies: { graph: { nodes: [], edges: [] } },
    ...overrides,
  };
}

// ============================================================
// SharedEntityIndexer 테스트
// ============================================================

describe('SharedEntityIndexer', () => {
  const indexer = new SharedEntityIndexer();

  describe('build', () => {
    it('should build empty index when no projects', () => {
      const result = indexer.build(new Map());
      expect(result.version).toBe(1);
      expect(Object.keys(result.tables)).toHaveLength(0);
      expect(Object.keys(result.events)).toHaveLength(0);
    });

    it('should build table reverse index from models', () => {
      const projectA = createMinimalCodeIndex({
        models: [{
          id: 'model-1',
          name: 'Order',
          filePath: 'src/Order.java',
          type: 'entity',
          fields: [
            { name: 'id', type: 'Long', required: true, columnName: 'id', isPrimaryKey: true },
            { name: 'orderNumber', type: 'String', required: true, columnName: 'order_number' },
          ],
          relatedApis: [],
          tableName: 'orders',
        }],
      });

      const projectB = createMinimalCodeIndex({
        models: [{
          id: 'model-2',
          name: 'OrderEntity',
          filePath: 'src/OrderEntity.kt',
          type: 'entity',
          fields: [
            { name: 'id', type: 'Long', required: true, columnName: 'id', isPrimaryKey: true },
            { name: 'status', type: 'String', required: true, columnName: 'status' },
          ],
          relatedApis: [],
          tableName: 'orders',
        }],
      });

      const map = new Map<string, CodeIndex>();
      map.set('project-a', projectA);
      map.set('project-b', projectB);

      const result = indexer.build(map);

      expect(result.tables['orders']).toBeDefined();
      expect(result.tables['orders']).toHaveLength(2);
      expect(result.tables['orders'][0].projectId).toBe('project-a');
      expect(result.tables['orders'][1].projectId).toBe('project-b');
    });

    it('should build event reverse index from events', () => {
      const projectA = createMinimalCodeIndex({
        events: [{
          id: 'event-1',
          name: 'order-created',
          topic: 'order-events',
          type: 'kafka',
          role: 'publisher',
          filePath: 'src/OrderService.java',
          handler: 'createOrder',
          line: 10,
        }],
      });

      const projectB = createMinimalCodeIndex({
        events: [{
          id: 'event-2',
          name: 'order-events',
          topic: 'order-events',
          type: 'kafka',
          role: 'subscriber',
          filePath: 'src/OrderEventHandler.kt',
          handler: 'handleOrder',
          line: 15,
        }],
      });

      const map = new Map<string, CodeIndex>();
      map.set('project-a', projectA);
      map.set('project-b', projectB);

      const result = indexer.build(map);

      expect(result.events['order-events']).toBeDefined();
      expect(result.events['order-events']).toHaveLength(2);
    });
  });

  describe('getSharedTables', () => {
    it('should return only tables referenced by 2+ projects', () => {
      const projectA = createMinimalCodeIndex({
        models: [
          { id: 'm1', name: 'Order', filePath: 'a/Order.java', type: 'entity', fields: [], relatedApis: [], tableName: 'orders' },
          { id: 'm2', name: 'Product', filePath: 'a/Product.java', type: 'entity', fields: [], relatedApis: [], tableName: 'products' },
        ],
      });

      const projectB = createMinimalCodeIndex({
        models: [
          { id: 'm3', name: 'OrderRef', filePath: 'b/OrderRef.java', type: 'entity', fields: [], relatedApis: [], tableName: 'orders' },
        ],
      });

      const map = new Map<string, CodeIndex>();
      map.set('a', projectA);
      map.set('b', projectB);

      const sharedIndex = indexer.build(map);
      const shared = indexer.getSharedTables(sharedIndex);

      expect(Object.keys(shared)).toContain('orders');
      expect(Object.keys(shared)).not.toContain('products');
    });
  });

  describe('getSharedEvents', () => {
    it('should return events with pub/sub matching', () => {
      const projectA = createMinimalCodeIndex({
        events: [
          { id: 'e1', name: 'topic-1', topic: 'topic-1', type: 'kafka', role: 'publisher', filePath: 'a.java', handler: 'pub', line: 1 },
          { id: 'e2', name: 'topic-2', topic: 'topic-2', type: 'kafka', role: 'publisher', filePath: 'a.java', handler: 'pub2', line: 2 },
        ],
      });

      const projectB = createMinimalCodeIndex({
        events: [
          { id: 'e3', name: 'topic-1', topic: 'topic-1', type: 'kafka', role: 'subscriber', filePath: 'b.java', handler: 'sub', line: 1 },
        ],
      });

      const map = new Map<string, CodeIndex>();
      map.set('a', projectA);
      map.set('b', projectB);

      const sharedIndex = indexer.build(map);
      const shared = indexer.getSharedEvents(sharedIndex);

      expect(Object.keys(shared)).toContain('topic-1');
      // topic-2 has no subscriber, but it's in a different project so it could be shared
      // Actually topic-2 is only in project-a, so not shared
    });
  });

  describe('search', () => {
    it('should find tables and events by keyword', () => {
      const projectA = createMinimalCodeIndex({
        models: [
          { id: 'm1', name: 'Order', filePath: 'Order.java', type: 'entity', fields: [], relatedApis: [], tableName: 'orders' },
          { id: 'm2', name: 'Product', filePath: 'Product.java', type: 'entity', fields: [], relatedApis: [], tableName: 'products' },
        ],
        events: [
          { id: 'e1', name: 'order-created', type: 'kafka', role: 'publisher', filePath: 'a.java', handler: 'pub', line: 1, topic: 'order-topic' },
        ],
      });

      const map = new Map<string, CodeIndex>();
      map.set('a', projectA);

      const sharedIndex = indexer.build(map);
      const results = indexer.search(sharedIndex, 'order');

      expect(results.tables.length).toBe(1);
      expect(results.tables[0].name).toBe('orders');
      expect(results.events.length).toBe(1);
      expect(results.events[0].name).toBe('order-topic');
    });
  });

  describe('findProjectsByTable', () => {
    it('should return empty array for non-existent table', () => {
      const index: SharedEntityIndex = {
        version: 1,
        updatedAt: new Date().toISOString(),
        tables: {},
        events: {},
      };
      expect(indexer.findProjectsByTable(index, 'nonexistent')).toEqual([]);
    });
  });

  describe('findProjectsByEvent', () => {
    it('should return empty array for non-existent event', () => {
      const index: SharedEntityIndex = {
        version: 1,
        updatedAt: new Date().toISOString(),
        tables: {},
        events: {},
      };
      expect(indexer.findProjectsByEvent(index, 'nonexistent')).toEqual([]);
    });
  });
});

// ============================================================
// ReverseCommand 테스트
// ============================================================

describe('ReverseCommand', () => {
  it('should be importable', async () => {
    const { ReverseCommand } = await import('../../../src/commands/reverse');
    expect(ReverseCommand).toBeDefined();
  });

  it('should fail without query', async () => {
    const { ReverseCommand } = await import('../../../src/commands/reverse');
    const cmd = new ReverseCommand([]);
    const result = await cmd.execute();
    expect(result.code).toBe('FAILURE');
  });

  it('should fail without projects', async () => {
    const { ReverseCommand } = await import('../../../src/commands/reverse');
    const cmd = new ReverseCommand(['--table', 'orders']);
    const result = await cmd.execute();
    expect(result.code).toBe('FAILURE');
    expect(result.message).toContain('프로젝트');
  });
});

// ============================================================
// detectLinks 확장 테스트 (LinkType 'shared-db')
// ============================================================

describe('LinkType shared-db', () => {
  it('should include shared-db in LinkType', () => {
    // TypeScript 컴파일만으로도 검증되지만 런타임 체크
    const linkType: import('../../../src/core/cross-project/types').LinkType = 'shared-db';
    expect(linkType).toBe('shared-db');
  });
});
