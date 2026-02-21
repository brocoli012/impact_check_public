/**
 * @module tests/unit/cross-project/cross-analyzer
 * @description CrossAnalyzer 단위 테스트
 *
 * 크로스 프로젝트 영향도 분석 로직을 검증합니다.
 */

import { CrossAnalyzer } from '../../../src/core/cross-project/cross-analyzer';
import { CrossProjectManager } from '../../../src/core/cross-project/cross-project-manager';
import { ApiContractChecker } from '../../../src/core/cross-project/api-contract-checker';
import { Indexer } from '../../../src/core/indexing/indexer';
import { CodeIndex, ApiEndpoint } from '../../../src/types/index';
import {
  ProjectLink,
  ProjectGroup,
  ApiContractChange,
} from '../../../src/core/cross-project/types';

// ============================================================
// Mocks
// ============================================================

jest.mock('../../../src/core/cross-project/cross-project-manager');
jest.mock('../../../src/core/cross-project/api-contract-checker');
jest.mock('../../../src/core/indexing/indexer');

const MockManager = CrossProjectManager as jest.MockedClass<typeof CrossProjectManager>;
const MockChecker = ApiContractChecker as jest.MockedClass<typeof ApiContractChecker>;
const MockIndexer = Indexer as jest.MockedClass<typeof Indexer>;

// ============================================================
// Helpers
// ============================================================

function createTestApi(overrides?: Partial<ApiEndpoint>): ApiEndpoint {
  return {
    id: 'api-1',
    method: 'GET',
    path: '/api/users',
    filePath: 'src/routes/users.ts',
    handler: 'getUsers',
    calledBy: [],
    requestParams: [],
    responseType: 'User[]',
    relatedModels: [],
    ...overrides,
  };
}

function createTestIndex(
  projectName: string,
  apis: ApiEndpoint[],
  components?: CodeIndex['components'],
): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2026-02-17T09:00:00Z',
      updatedAt: '2026-02-17T10:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: projectName,
        path: `/path/to/${projectName}`,
        techStack: ['typescript'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 2,
        components: 5,
        apiEndpoints: apis.length,
        models: 0,
        modules: 3,
      },
    },
    files: [],
    screens: [],
    components: components || [],
    apis,
    models: [],
    events: [],
    policies: [],
    dependencies: { graph: { nodes: [], edges: [] } },
  };
}

function createTestLink(overrides?: Partial<ProjectLink>): ProjectLink {
  return {
    id: 'frontend-backend',
    source: 'frontend',
    target: 'backend',
    type: 'api-consumer',
    autoDetected: false,
    confirmedAt: '2026-02-17T10:00:00Z',
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('CrossAnalyzer', () => {
  let manager: jest.Mocked<CrossProjectManager>;
  let checker: jest.Mocked<ApiContractChecker>;
  let indexer: jest.Mocked<Indexer>;
  let analyzer: CrossAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();

    manager = new MockManager() as jest.Mocked<CrossProjectManager>;
    checker = new MockChecker() as jest.Mocked<ApiContractChecker>;
    indexer = new MockIndexer() as jest.Mocked<Indexer>;
    analyzer = new CrossAnalyzer(manager, checker);
  });

  // ============================================================
  // analyze: 기본 동작
  // ============================================================

  describe('analyze: 기본 동작', () => {
    it('연결된 프로젝트를 분석하여 CrossProjectImpact를 반환한다', async () => {
      const sourceApis = [
        createTestApi({ path: '/api/users', id: 'api-1' }),
        createTestApi({ path: '/api/orders', id: 'api-2' }),
      ];
      const targetApis = [
        createTestApi({ path: '/api/users', id: 'api-3' }),
      ];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') {
          return createTestIndex('backend', sourceApis);
        }
        if (projectId === 'frontend') {
          return createTestIndex('frontend', targetApis);
        }
        return null;
      });

      checker.checkContracts.mockResolvedValue([]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result).toBeDefined();
      expect(result.affectedProjects).toBeDefined();
      expect(result.apiContractChanges).toBeDefined();
      expect(Array.isArray(result.affectedProjects)).toBe(true);
      expect(Array.isArray(result.apiContractChanges)).toBe(true);
    });
  });

  // ============================================================
  // analyze: API 계약 변경 감지
  // ============================================================

  describe('analyze: API 계약 변경 감지', () => {
    it('API 계약 변경이 있으면 apiContractChanges에 포함된다', async () => {
      const sourceApis = [
        createTestApi({ path: '/api/users', id: 'api-1' }),
      ];
      const targetApis = [
        createTestApi({ path: '/api/users', id: 'api-2' }),
      ];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') {
          return createTestIndex('backend', sourceApis);
        }
        if (projectId === 'frontend') {
          return createTestIndex('frontend', targetApis);
        }
        return null;
      });

      const contractChange: ApiContractChange = {
        apiPath: '/api/users',
        changeType: 'modify',
        consumers: ['consumer'],
        severity: 'warning',
      };

      checker.checkContracts.mockResolvedValue([contractChange]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.apiContractChanges.length).toBeGreaterThan(0);
      expect(result.apiContractChanges[0].apiPath).toBe('/api/users');
    });
  });

  // ============================================================
  // analyze: 영향 수준 계산
  // ============================================================

  describe('analyze: 영향 수준 계산', () => {
    it('삭제된 API를 consumer가 사용하면 critical', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const targetApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', targetApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([{
        apiPath: '/api/users',
        changeType: 'remove',
        consumers: ['frontend'],
        severity: 'critical',
      }]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.affectedProjects.length).toBe(1);
      expect(result.affectedProjects[0].impactLevel).toBe('critical');
    });

    it('비하위 호환 변경이면 high', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const targetApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', targetApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([{
        apiPath: '/api/users',
        changeType: 'modify',
        consumers: ['frontend'],
        severity: 'warning',
      }]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.affectedProjects.length).toBe(1);
      expect(result.affectedProjects[0].impactLevel).toBe('high');
    });

    it('하위 호환 변경(add)이면 medium', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const targetApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', targetApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([{
        apiPath: '/api/users',
        changeType: 'add',
        consumers: [],
        severity: 'info',
      }]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.affectedProjects.length).toBe(1);
      expect(result.affectedProjects[0].impactLevel).toBe('medium');
    });

    it('간접 영향만 있으면 low', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const targetApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', targetApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.affectedProjects.length).toBe(1);
      expect(result.affectedProjects[0].impactLevel).toBe('low');
    });
  });

  // ============================================================
  // analyze: 링크 없을 때 빈 결과
  // ============================================================

  describe('analyze: 링크 없을 때 빈 결과', () => {
    it('연결된 프로젝트가 없으면 빈 결과를 반환한다', async () => {
      manager.getLinks.mockResolvedValue([]);

      const result = await analyzer.analyze('solo-project', indexer);

      expect(result.affectedProjects).toEqual([]);
      expect(result.apiContractChanges).toEqual([]);
      expect(indexer.loadIndex).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // analyze: 인덱스 로드 실패 시 건너뛰기
  // ============================================================

  describe('analyze: 인덱스 로드 실패 시 건너뛰기', () => {
    it('소스 프로젝트 인덱스 로드 실패 시 빈 결과 반환', async () => {
      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockResolvedValue(null);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.affectedProjects).toEqual([]);
      expect(result.apiContractChanges).toEqual([]);
    });

    it('대상 프로젝트 인덱스 로드 실패 시 해당 프로젝트를 건너뛴다', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
        createTestLink({ source: 'backend', target: 'mobile', id: 'backend-mobile' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return null; // 로드 실패
        if (projectId === 'mobile') return createTestIndex('mobile', [createTestApi({ path: '/api/users' })]);
        return null;
      });

      checker.checkContracts.mockResolvedValue([]);

      const result = await analyzer.analyze('backend', indexer);

      // frontend는 건너뛰고 mobile만 분석됨
      const projectIds = result.affectedProjects.map(p => p.projectId);
      expect(projectIds).not.toContain('frontend');
    });
  });

  // ============================================================
  // analyze: groupName 필터
  // ============================================================

  describe('analyze: groupName 필터', () => {
    it('groupName 지정 시 해당 그룹의 프로젝트만 분석한다', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const frontendApis = [createTestApi({ path: '/api/users' })];
      const mobileApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
        createTestLink({ source: 'backend', target: 'mobile', id: 'backend-mobile' }),
      ]);

      const commerceGroup: ProjectGroup = {
        name: 'commerce',
        projects: ['backend', 'frontend'],
      };
      manager.getGroup.mockResolvedValue(commerceGroup);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', frontendApis);
        if (projectId === 'mobile') return createTestIndex('mobile', mobileApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([]);

      const result = await analyzer.analyze('backend', indexer, {
        groupName: 'commerce',
      });

      // commerce 그룹에 mobile은 포함되지 않으므로 frontend만 분석
      const projectIds = result.affectedProjects.map(p => p.projectId);
      expect(projectIds).not.toContain('mobile');
    });

    it('존재하지 않는 그룹이면 빈 결과 반환', async () => {
      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      manager.getGroup.mockResolvedValue(null);

      const result = await analyzer.analyze('backend', indexer, {
        groupName: 'nonexistent',
      });

      expect(result.affectedProjects).toEqual([]);
      expect(result.apiContractChanges).toEqual([]);
    });
  });

  // ============================================================
  // analyze: depth=1 (직접 연결만)
  // ============================================================

  describe('analyze: depth=1 (직접 연결만)', () => {
    it('직접 연결된 프로젝트만 분석하고 간접 연결은 무시한다', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const frontendApis = [createTestApi({ path: '/api/users' })];

      // backend -> frontend 링크만 있음 (frontend -> mobile 간접 연결은 getLinks에서 반환되지 않음)
      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', frontendApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([]);

      const result = await analyzer.analyze('backend', indexer);

      // 직접 연결된 frontend만 분석됨
      const projectIds = result.affectedProjects.map(p => p.projectId);
      expect(projectIds).toContain('frontend');
      expect(projectIds).not.toContain('mobile');
    });
  });

  // ============================================================
  // affectedProjects 구조 검증
  // ============================================================

  describe('affectedProjects 구조 검증', () => {
    it('AffectedProject 객체가 올바른 필드를 포함한다', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const targetApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', targetApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([{
        apiPath: '/api/users',
        changeType: 'modify',
        consumers: ['frontend'],
        severity: 'warning',
      }]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.affectedProjects.length).toBe(1);

      const proj = result.affectedProjects[0];
      expect(proj).toHaveProperty('projectId');
      expect(proj).toHaveProperty('projectName');
      expect(proj).toHaveProperty('impactLevel');
      expect(proj).toHaveProperty('affectedApis');
      expect(proj).toHaveProperty('affectedComponents');
      expect(proj).toHaveProperty('summary');

      expect(proj.projectId).toBe('frontend');
      expect(proj.projectName).toBe('frontend');
      expect(Array.isArray(proj.affectedApis)).toBe(true);
      expect(typeof proj.affectedComponents).toBe('number');
      expect(typeof proj.summary).toBe('string');
    });
  });

  // ============================================================
  // apiContractChanges 구조 검증
  // ============================================================

  describe('apiContractChanges 구조 검증', () => {
    it('ApiContractChange 객체가 올바른 필드를 포함한다', async () => {
      const sourceApis = [createTestApi({ path: '/api/users' })];
      const targetApis = [createTestApi({ path: '/api/users' })];

      manager.getLinks.mockResolvedValue([
        createTestLink({ source: 'backend', target: 'frontend' }),
      ]);

      indexer.loadIndex.mockImplementation(async (projectId: string) => {
        if (projectId === 'backend') return createTestIndex('backend', sourceApis);
        if (projectId === 'frontend') return createTestIndex('frontend', targetApis);
        return null;
      });

      checker.checkContracts.mockResolvedValue([{
        apiPath: '/api/users',
        changeType: 'remove',
        consumers: ['consumer'],
        severity: 'critical',
      }]);

      const result = await analyzer.analyze('backend', indexer);

      expect(result.apiContractChanges.length).toBe(1);

      const change = result.apiContractChanges[0];
      expect(change).toHaveProperty('apiPath');
      expect(change).toHaveProperty('changeType');
      expect(change).toHaveProperty('consumers');
      expect(change).toHaveProperty('severity');

      expect(change.apiPath).toBe('/api/users');
      expect(['add', 'modify', 'remove']).toContain(change.changeType);
      expect(Array.isArray(change.consumers)).toBe(true);
      expect(['info', 'warning', 'critical']).toContain(change.severity);
    });
  });
});
