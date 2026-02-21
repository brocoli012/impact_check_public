/**
 * @module tests/unit/server/reverse-api.test
 * @description 역추적 API 엔드포인트 테스트 (Phase C: TASK-103~107)
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-reverse-data');
const PROJECT_A = 'project-a';
const PROJECT_B = 'project-b';

function setupTestData(): void {
  const impactDir = path.join(TEST_BASE, '.impact');
  ensureDir(impactDir);

  // projects.json
  writeJsonFile(path.join(impactDir, 'projects.json'), {
    activeProject: PROJECT_A,
    projects: [
      {
        id: PROJECT_A,
        name: 'Project A',
        path: '/tmp/project-a',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        techStack: ['spring'],
      },
      {
        id: PROJECT_B,
        name: 'Project B',
        path: '/tmp/project-b',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        techStack: ['spring'],
      },
    ],
  });

  writeJsonFile(path.join(impactDir, 'config.json'), {
    version: 1,
    general: { autoReindex: true, webPort: 3847, logLevel: 'info' },
  });

  // Project A index with shared table and event
  const indexDirA = path.join(impactDir, 'projects', PROJECT_A, 'index');
  ensureDir(indexDirA);
  writeJsonFile(path.join(indexDirA, 'meta.json'), {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gitCommit: 'aaa111',
    gitBranch: 'main',
    project: { name: 'project-a', path: '/tmp/project-a', techStack: ['spring'], packageManager: 'gradle' },
    stats: { totalFiles: 5, screens: 0, components: 0, apiEndpoints: 0, models: 2, modules: 1, events: 1 },
  });
  writeJsonFile(path.join(indexDirA, 'files.json'), []);
  writeJsonFile(path.join(indexDirA, 'screens.json'), []);
  writeJsonFile(path.join(indexDirA, 'components.json'), []);
  writeJsonFile(path.join(indexDirA, 'apis.json'), []);
  writeJsonFile(path.join(indexDirA, 'policies.json'), []);
  writeJsonFile(path.join(indexDirA, 'dependencies.json'), { graph: { nodes: [], edges: [] } });
  writeJsonFile(path.join(indexDirA, 'models.json'), [
    {
      id: 'model-a-orders',
      name: 'OrderEntity',
      filePath: 'src/entity/OrderEntity.java',
      type: 'entity',
      fields: [
        { name: 'id', type: 'Long', required: true, columnName: 'id', isPrimaryKey: true },
        { name: 'amount', type: 'BigDecimal', required: true, columnName: 'amount' },
      ],
      relatedApis: [],
      tableName: 'orders',
      annotations: ['@Entity'],
    },
    {
      id: 'model-a-users',
      name: 'UserEntity',
      filePath: 'src/entity/UserEntity.java',
      type: 'entity',
      fields: [
        { name: 'id', type: 'Long', required: true, columnName: 'id', isPrimaryKey: true },
      ],
      relatedApis: [],
      tableName: 'users',
      annotations: ['@Entity'],
    },
  ]);
  writeJsonFile(path.join(indexDirA, 'events.json'), [
    {
      id: 'event-a-order-created',
      name: 'OrderCreatedEvent',
      topic: 'order-created',
      type: 'kafka',
      role: 'publisher',
      filePath: 'src/service/OrderService.java',
      handler: 'createOrder',
      line: 45,
    },
  ]);

  // Project B index with same table reference and event subscriber
  const indexDirB = path.join(impactDir, 'projects', PROJECT_B, 'index');
  ensureDir(indexDirB);
  writeJsonFile(path.join(indexDirB, 'meta.json'), {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gitCommit: 'bbb222',
    gitBranch: 'main',
    project: { name: 'project-b', path: '/tmp/project-b', techStack: ['spring'], packageManager: 'gradle' },
    stats: { totalFiles: 3, screens: 0, components: 0, apiEndpoints: 0, models: 1, modules: 1, events: 1 },
  });
  writeJsonFile(path.join(indexDirB, 'files.json'), []);
  writeJsonFile(path.join(indexDirB, 'screens.json'), []);
  writeJsonFile(path.join(indexDirB, 'components.json'), []);
  writeJsonFile(path.join(indexDirB, 'apis.json'), []);
  writeJsonFile(path.join(indexDirB, 'policies.json'), []);
  writeJsonFile(path.join(indexDirB, 'dependencies.json'), { graph: { nodes: [], edges: [] } });
  writeJsonFile(path.join(indexDirB, 'models.json'), [
    {
      id: 'model-b-orders',
      name: 'OrderReadModel',
      filePath: 'src/model/OrderReadModel.java',
      type: 'entity',
      fields: [
        { name: 'orderId', type: 'Long', required: true, columnName: 'order_id', isPrimaryKey: true },
        { name: 'totalAmount', type: 'BigDecimal', required: true, columnName: 'total_amount' },
      ],
      relatedApis: [],
      tableName: 'orders',
      annotations: ['@Entity'],
    },
  ]);
  writeJsonFile(path.join(indexDirB, 'events.json'), [
    {
      id: 'event-b-order-created',
      name: 'OrderCreatedEvent',
      topic: 'order-created',
      type: 'kafka',
      role: 'subscriber',
      filePath: 'src/listener/OrderListener.java',
      handler: 'handleOrderCreated',
      line: 20,
    },
  ]);

  // Results directory (empty, but needed)
  const resultsA = path.join(impactDir, 'projects', PROJECT_A, 'results');
  ensureDir(resultsA);
  writeJsonFile(path.join(resultsA, 'index.json'), []);
  const resultsB = path.join(impactDir, 'projects', PROJECT_B, 'results');
  ensureDir(resultsB);
  writeJsonFile(path.join(resultsB, 'index.json'), []);
}

function cleanupTestData(): void {
  if (fs.existsSync(TEST_BASE)) {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  }
}

describe('Reverse Tracking API', () => {
  beforeAll(() => {
    setupTestData();
  });

  afterAll(() => {
    cleanupTestData();
  });

  const app = createApp(TEST_BASE);

  // ============================================================
  // GET /api/reverse/table/:name
  // ============================================================

  describe('GET /api/reverse/table/:name', () => {
    it('should return references for shared table', async () => {
      const res = await request(app).get('/api/reverse/table/orders');
      expect(res.status).toBe(200);
      expect(res.body.tableName).toBe('orders');
      expect(res.body.references).toHaveLength(2);
      expect(res.body.isShared).toBe(true);
      expect(res.body.total).toBe(2);
    });

    it('should return single-project table reference', async () => {
      const res = await request(app).get('/api/reverse/table/users');
      expect(res.status).toBe(200);
      expect(res.body.tableName).toBe('users');
      expect(res.body.references).toHaveLength(1);
      expect(res.body.isShared).toBe(false);
    });

    it('should return empty for nonexistent table', async () => {
      const res = await request(app).get('/api/reverse/table/nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.references).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  // ============================================================
  // GET /api/reverse/event/:name
  // ============================================================

  describe('GET /api/reverse/event/:name', () => {
    it('should return publisher and subscriber for shared event', async () => {
      const res = await request(app).get('/api/reverse/event/order-created');
      expect(res.status).toBe(200);
      expect(res.body.eventName).toBe('order-created');
      expect(res.body.publishers).toHaveLength(1);
      expect(res.body.subscribers).toHaveLength(1);
      expect(res.body.total).toBe(2);
    });

    it('should return empty for nonexistent event', async () => {
      const res = await request(app).get('/api/reverse/event/nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.references).toHaveLength(0);
    });
  });

  // ============================================================
  // GET /api/reverse/search?q=
  // ============================================================

  describe('GET /api/reverse/search', () => {
    it('should search tables and events by keyword', async () => {
      const res = await request(app).get('/api/reverse/search?q=order');
      expect(res.status).toBe(200);
      expect(res.body.query).toBe('order');
      expect(res.body.totalTables).toBeGreaterThanOrEqual(1);
      expect(res.body.totalEvents).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for non-matching keyword', async () => {
      const res = await request(app).get('/api/reverse/search?q=zzzzz');
      expect(res.status).toBe(200);
      expect(res.body.totalTables).toBe(0);
      expect(res.body.totalEvents).toBe(0);
    });

    it('should return 400 when q is missing', async () => {
      const res = await request(app).get('/api/reverse/search');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // GET /api/shared-entities
  // ============================================================

  describe('GET /api/shared-entities', () => {
    it('should return shared tables and events summary', async () => {
      const res = await request(app).get('/api/shared-entities');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tables');
      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('stats');
      expect(Array.isArray(res.body.tables)).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('should include orders as shared table', async () => {
      const res = await request(app).get('/api/shared-entities');
      const ordersTable = res.body.tables.find((t: { name: string }) => t.name === 'orders');
      expect(ordersTable).toBeDefined();
      expect(ordersTable.projects).toHaveLength(2);
    });

    it('should include order-created as shared event', async () => {
      const res = await request(app).get('/api/shared-entities');
      const orderEvent = res.body.events.find((e: { name: string }) => e.name === 'order-created');
      expect(orderEvent).toBeDefined();
      expect(orderEvent.publishers).toHaveLength(1);
      expect(orderEvent.subscribers).toHaveLength(1);
    });

    it('should include stats', async () => {
      const res = await request(app).get('/api/shared-entities');
      expect(res.body.stats.projectCount).toBe(2);
      expect(res.body.stats.sharedTables).toBeGreaterThanOrEqual(1);
    });
  });
});
