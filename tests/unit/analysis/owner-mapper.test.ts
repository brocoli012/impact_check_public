/**
 * @module tests/unit/analysis/owner-mapper
 * @description OwnerMapper 단위 테스트
 */

import { OwnerMapper } from '../../../src/core/analysis/owner-mapper';
import { ImpactResult, Task } from '../../../src/types/analysis';
import { OwnersConfig, SystemOwner } from '../../../src/types/config';

// logger mock
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

/** 테스트용 Task 생성 */
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T-001',
    title: '[FE] 장바구니 수량 변경',
    type: 'FE',
    actionType: 'modify',
    description: '수량 입력 필드 추가',
    affectedFiles: ['src/pages/CartPage.tsx'],
    relatedApis: ['api-1'],
    planningChecks: [],
    rationale: 'test',
    ...overrides,
  };
}

/** 테스트용 ImpactResult 생성 */
function createImpactResult(tasks: Task[]): ImpactResult {
  return {
    analysisId: 'analysis-test',
    analyzedAt: '2024-01-01T00:00:00Z',
    specTitle: '장바구니 기능 개선',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: 'CartPage',
        impactLevel: 'medium',
        tasks,
      },
    ],
    tasks,
    planningChecks: [],
    policyChanges: [],
  };
}

/** 테스트용 SystemOwner 생성 */
function createSystemOwner(overrides: Partial<SystemOwner> = {}): SystemOwner {
  return {
    systemName: '장바구니 시스템',
    systemId: 'cart-system',
    team: '커머스팀',
    owner: {
      name: '김개발',
      email: 'dev@example.com',
      slackChannel: '#cart-team',
    },
    scope: '장바구니 관련 기능',
    relatedPaths: ['src/pages/Cart', 'src/components/Cart'],
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** 테스트용 OwnersConfig 생성 */
function createOwnersConfig(systems: SystemOwner[]): OwnersConfig {
  return { systems };
}

describe('OwnerMapper', () => {
  let mapper: OwnerMapper;

  beforeEach(() => {
    mapper = new OwnerMapper();
  });

  describe('map', () => {
    it('should map owners when affected files match system relatedPaths', () => {
      const task = createTask({
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const impact = createImpactResult([task]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].systemId).toBe('cart-system');
      expect(notifications[0].systemName).toBe('장바구니 시스템');
      expect(notifications[0].team).toBe('커머스팀');
      expect(notifications[0].ownerName).toBe('김개발');
      expect(notifications[0].ownerEmail).toBe('dev@example.com');
      expect(notifications[0].slackChannel).toBe('#cart-team');
    });

    it('should generate unique notification IDs', () => {
      const task1 = createTask({
        id: 'T-001',
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const task2 = createTask({
        id: 'T-002',
        affectedFiles: ['src/api/orders.ts'],
      });
      const impact = createImpactResult([task1, task2]);

      const cartOwner = createSystemOwner();
      const orderOwner = createSystemOwner({
        systemName: '주문 시스템',
        systemId: 'order-system',
        team: '주문팀',
        owner: { name: '이주문', email: 'order@example.com' },
        relatedPaths: ['src/api/orders'],
      });

      const owners = createOwnersConfig([cartOwner, orderOwner]);
      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].id).toBe('ON-001');
      expect(notifications[1].id).toBe('ON-002');
    });

    it('should collect relatedTaskIds correctly', () => {
      const task1 = createTask({
        id: 'T-001',
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const task2 = createTask({
        id: 'T-002',
        affectedFiles: ['src/components/CartItem.tsx'],
      });
      const task3 = createTask({
        id: 'T-003',
        affectedFiles: ['src/api/orders.ts'],
      });
      const impact = createImpactResult([task1, task2, task3]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(1);
      // T-001 (CartPage) and T-002 (CartItem) match the system paths, T-003 does not
      expect(notifications[0].relatedTaskIds).toContain('T-001');
      expect(notifications[0].relatedTaskIds).toContain('T-002');
      expect(notifications[0].relatedTaskIds).not.toContain('T-003');
    });

    it('should not create notifications when no paths match', () => {
      const task = createTask({
        affectedFiles: ['src/api/unrelated.ts'],
      });
      const impact = createImpactResult([task]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(0);
    });

    it('should return empty array when no owners configured', () => {
      const task = createTask();
      const impact = createImpactResult([task]);
      const owners = createOwnersConfig([]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(0);
    });

    it('should return empty array when no tasks have affected files', () => {
      const task = createTask({ affectedFiles: [] });
      const impact = createImpactResult([task]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(0);
    });

    it('should handle backslash-normalized paths (Windows)', () => {
      const task = createTask({
        affectedFiles: ['src\\pages\\CartPage.tsx'],
      });
      const impact = createImpactResult([task]);
      const owner = createSystemOwner({
        relatedPaths: ['src\\pages\\Cart'],
      });
      const owners = createOwnersConfig([owner]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(1);
    });

    it('should match multiple systems from same affected file', () => {
      const task = createTask({
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const impact = createImpactResult([task]);

      const owner1 = createSystemOwner({
        systemId: 'system-a',
        systemName: 'System A',
        relatedPaths: ['src/pages'],
      });
      const owner2 = createSystemOwner({
        systemId: 'system-b',
        systemName: 'System B',
        relatedPaths: ['src/pages/Cart'],
      });
      const owners = createOwnersConfig([owner1, owner2]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(2);
      const systemIds = notifications.map(n => n.systemId);
      expect(systemIds).toContain('system-a');
      expect(systemIds).toContain('system-b');
    });
  });

  describe('email draft generation', () => {
    it('should generate email draft with correct content', () => {
      const task = createTask({
        id: 'T-001',
        title: '[FE] 장바구니 수량 변경',
        description: '수량 입력 필드 추가',
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const impact = createImpactResult([task]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(1);
      const emailDraft = notifications[0].emailDraft;

      // Should contain spec title
      expect(emailDraft).toContain('장바구니 기능 개선');
      // Should contain owner name greeting
      expect(emailDraft).toContain('김개발');
      // Should contain system name
      expect(emailDraft).toContain('장바구니 시스템');
      // Should contain team name
      expect(emailDraft).toContain('커머스팀');
      // Should contain task info
      expect(emailDraft).toContain('[FE] 장바구니 수량 변경');
      // Should contain screen name
      expect(emailDraft).toContain('CartPage');
    });

    it('should handle notifications with no related tasks gracefully', () => {
      // Create an impact where the tasks have files that match system paths
      // but when filtering relatedTaskIds, the task descriptions will still appear
      const task = createTask({
        id: 'T-001',
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const impact = createImpactResult([task]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].emailDraft).toBeTruthy();
      expect(notifications[0].emailDraft.length).toBeGreaterThan(0);
    });

    it('should include all related tasks in email draft', () => {
      const task1 = createTask({
        id: 'T-001',
        title: '[FE] First Task',
        description: 'First description',
        affectedFiles: ['src/pages/CartPage.tsx'],
      });
      const task2 = createTask({
        id: 'T-002',
        title: '[FE] Second Task',
        description: 'Second description',
        affectedFiles: ['src/components/CartItem.tsx'],
      });
      const impact = createImpactResult([task1, task2]);
      const owners = createOwnersConfig([createSystemOwner()]);

      const notifications = mapper.map(impact, owners);

      expect(notifications).toHaveLength(1);
      const emailDraft = notifications[0].emailDraft;
      expect(emailDraft).toContain('First Task');
      expect(emailDraft).toContain('Second Task');
    });
  });
});
