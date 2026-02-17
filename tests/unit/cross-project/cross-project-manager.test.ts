/**
 * @module tests/unit/cross-project/cross-project-manager
 * @description CrossProjectManager 단위 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CrossProjectManager } from '../../../src/core/cross-project/cross-project-manager';
import { Indexer } from '../../../src/core/indexing/indexer';
import { CodeIndex, ApiEndpoint } from '../../../src/types/index';
import {
  CrossProjectConfig,
  ProjectLink,
  ProjectGroup,
  LinkType,
  CrossProjectImpact,
  AffectedProject,
  ApiContractChange,
} from '../../../src/core/cross-project/types';

describe('CrossProjectManager', () => {
  let tmpDir: string;
  let manager: CrossProjectManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-cross-project-'));
    manager = new CrossProjectManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ============================================================
  // loadConfig
  // ============================================================

  describe('loadConfig', () => {
    it('파일 없을 때 빈 설정 반환', async () => {
      const config = await manager.loadConfig();
      expect(config).toEqual({
        version: 1,
        links: [],
        groups: [],
      });
    });

    it('기존 설정 로드', async () => {
      const existingConfig: CrossProjectConfig = {
        version: 1,
        links: [
          {
            id: 'frontend-backend',
            source: 'frontend',
            target: 'backend',
            type: 'api-consumer',
            autoDetected: false,
            confirmedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        groups: [
          { name: 'commerce', projects: ['frontend', 'backend'] },
        ],
      };

      const configPath = path.join(tmpDir, 'cross-project.json');
      fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      const config = await manager.loadConfig();
      expect(config.version).toBe(1);
      expect(config.links).toHaveLength(1);
      expect(config.links[0].source).toBe('frontend');
      expect(config.links[0].target).toBe('backend');
      expect(config.groups).toHaveLength(1);
      expect(config.groups[0].name).toBe('commerce');
    });
  });

  // ============================================================
  // saveConfig
  // ============================================================

  describe('saveConfig', () => {
    it('설정 저장 및 재로드', async () => {
      const config: CrossProjectConfig = {
        version: 1,
        links: [
          {
            id: 'a-b',
            source: 'a',
            target: 'b',
            type: 'shared-library',
            autoDetected: false,
          },
        ],
        groups: [{ name: 'test-group', projects: ['a', 'b'] }],
      };

      await manager.saveConfig(config);

      const reloaded = await manager.loadConfig();
      expect(reloaded.version).toBe(1);
      expect(reloaded.links).toHaveLength(1);
      expect(reloaded.links[0].id).toBe('a-b');
      expect(reloaded.groups).toHaveLength(1);
      expect(reloaded.groups[0].name).toBe('test-group');
    });
  });

  // ============================================================
  // link
  // ============================================================

  describe('link', () => {
    it('의존성 등록', async () => {
      const link = await manager.link('frontend', 'backend', 'api-consumer');

      expect(link.id).toBe('frontend-backend');
      expect(link.source).toBe('frontend');
      expect(link.target).toBe('backend');
      expect(link.type).toBe('api-consumer');
      expect(link.autoDetected).toBe(false);
      expect(link.confirmedAt).toBeDefined();

      // 저장 검증
      const config = await manager.loadConfig();
      expect(config.links).toHaveLength(1);
    });

    it('중복 등록 방지', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');
      const duplicate = await manager.link('frontend', 'backend', 'api-provider');

      // 기존 링크가 반환되어야 함 (type은 원래 값 유지)
      expect(duplicate.type).toBe('api-consumer');

      const config = await manager.loadConfig();
      expect(config.links).toHaveLength(1);
    });

    it('api 목록 포함', async () => {
      const link = await manager.link(
        'frontend',
        'backend',
        'api-consumer',
        ['/api/products', '/api/cart'],
      );

      expect(link.apis).toEqual(['/api/products', '/api/cart']);
    });

    it('빈 api 목록은 포함하지 않음', async () => {
      const link = await manager.link('frontend', 'backend', 'api-consumer', []);

      expect(link.apis).toBeUndefined();
    });
  });

  // ============================================================
  // unlink
  // ============================================================

  describe('unlink', () => {
    it('의존성 해제', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');
      const result = await manager.unlink('frontend', 'backend');

      expect(result).toBe(true);

      const config = await manager.loadConfig();
      expect(config.links).toHaveLength(0);
    });

    it('양방향 삭제 (역방향)', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');
      // 역방향으로 unlink 시도
      const result = await manager.unlink('backend', 'frontend');

      expect(result).toBe(true);

      const config = await manager.loadConfig();
      expect(config.links).toHaveLength(0);
    });

    it('존재하지 않는 링크 false', async () => {
      const result = await manager.unlink('nonexistent-a', 'nonexistent-b');
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // getLinks
  // ============================================================

  describe('getLinks', () => {
    it('전체 조회', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');
      await manager.link('backend', 'database', 'shared-library');

      const links = await manager.getLinks();
      expect(links).toHaveLength(2);
    });

    it('프로젝트별 필터 (source)', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');
      await manager.link('backend', 'database', 'shared-library');

      const links = await manager.getLinks('frontend');
      expect(links).toHaveLength(1);
      expect(links[0].source).toBe('frontend');
    });

    it('프로젝트별 필터 (target)', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');
      await manager.link('backend', 'database', 'shared-library');

      const links = await manager.getLinks('backend');
      expect(links).toHaveLength(2); // frontend->backend, backend->database
    });

    it('매칭 없으면 빈 배열', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');

      const links = await manager.getLinks('nonexistent');
      expect(links).toHaveLength(0);
    });
  });

  // ============================================================
  // getLink
  // ============================================================

  describe('getLink', () => {
    it('특정 링크 조회', async () => {
      await manager.link('frontend', 'backend', 'api-consumer');

      const link = await manager.getLink('frontend', 'backend');
      expect(link).not.toBeNull();
      expect(link!.source).toBe('frontend');
      expect(link!.target).toBe('backend');
    });

    it('없으면 null', async () => {
      const link = await manager.getLink('a', 'b');
      expect(link).toBeNull();
    });
  });

  // ============================================================
  // addGroup
  // ============================================================

  describe('addGroup', () => {
    it('그룹 추가', async () => {
      const group = await manager.addGroup('commerce', ['frontend', 'backend', 'payment']);

      expect(group.name).toBe('commerce');
      expect(group.projects).toEqual(['frontend', 'backend', 'payment']);

      const config = await manager.loadConfig();
      expect(config.groups).toHaveLength(1);
    });

    it('동일 이름 그룹은 덮어쓰기', async () => {
      await manager.addGroup('commerce', ['frontend', 'backend']);
      const group = await manager.addGroup('commerce', ['frontend', 'backend', 'payment']);

      expect(group.projects).toHaveLength(3);

      const config = await manager.loadConfig();
      expect(config.groups).toHaveLength(1);
    });
  });

  // ============================================================
  // getGroup
  // ============================================================

  describe('getGroup', () => {
    it('그룹 조회', async () => {
      await manager.addGroup('commerce', ['frontend', 'backend']);

      const group = await manager.getGroup('commerce');
      expect(group).not.toBeNull();
      expect(group!.name).toBe('commerce');
      expect(group!.projects).toEqual(['frontend', 'backend']);
    });

    it('없으면 null', async () => {
      const group = await manager.getGroup('nonexistent');
      expect(group).toBeNull();
    });
  });

  // ============================================================
  // getGroups
  // ============================================================

  describe('getGroups', () => {
    it('전체 그룹 목록', async () => {
      await manager.addGroup('commerce', ['frontend', 'backend']);
      await manager.addGroup('delivery', ['logistics', 'tracking']);

      const groups = await manager.getGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('commerce');
      expect(groups[1].name).toBe('delivery');
    });

    it('그룹 없으면 빈 배열', async () => {
      const groups = await manager.getGroups();
      expect(groups).toHaveLength(0);
    });
  });

  // ============================================================
  // removeGroup
  // ============================================================

  describe('removeGroup', () => {
    it('그룹 삭제', async () => {
      await manager.addGroup('commerce', ['frontend', 'backend']);
      const result = await manager.removeGroup('commerce');

      expect(result).toBe(true);

      const config = await manager.loadConfig();
      expect(config.groups).toHaveLength(0);
    });

    it('존재하지 않는 그룹 삭제 false', async () => {
      const result = await manager.removeGroup('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // 타입 정의 검증
  // ============================================================

  describe('타입 정의 검증', () => {
    it('모든 LinkType 값이 유효', () => {
      const validTypes: LinkType[] = [
        'api-consumer',
        'api-provider',
        'shared-library',
        'shared-types',
        'event-publisher',
        'event-subscriber',
      ];

      // 타입스크립트 컴파일 타임에 검증되지만, 런타임 확인도 수행
      for (const type of validTypes) {
        expect(typeof type).toBe('string');
      }
    });

    it('CrossProjectConfig 구조 검증', () => {
      const config: CrossProjectConfig = {
        version: 1,
        links: [],
        groups: [],
      };

      expect(config.version).toBe(1);
      expect(Array.isArray(config.links)).toBe(true);
      expect(Array.isArray(config.groups)).toBe(true);
    });

    it('ProjectLink 구조 검증', () => {
      const link: ProjectLink = {
        id: 'test-id',
        source: 'source-project',
        target: 'target-project',
        type: 'api-consumer',
        autoDetected: false,
        confirmedAt: '2024-01-01T00:00:00.000Z',
        apis: ['/api/test'],
      };

      expect(link.id).toBe('test-id');
      expect(link.source).toBe('source-project');
      expect(link.target).toBe('target-project');
      expect(link.type).toBe('api-consumer');
      expect(link.autoDetected).toBe(false);
      expect(link.apis).toEqual(['/api/test']);
    });

    it('ProjectGroup 구조 검증', () => {
      const group: ProjectGroup = {
        name: 'test-group',
        projects: ['a', 'b', 'c'],
      };

      expect(group.name).toBe('test-group');
      expect(group.projects).toHaveLength(3);
    });

    it('CrossProjectImpact 구조 검증', () => {
      const impact: CrossProjectImpact = {
        affectedProjects: [
          {
            projectId: 'backend',
            projectName: 'Backend Service',
            impactLevel: 'high',
            affectedApis: ['/api/products'],
            affectedComponents: 5,
            summary: 'API 변경으로 인한 영향',
          },
        ],
        apiContractChanges: [
          {
            apiPath: '/api/products',
            changeType: 'modify',
            consumers: ['frontend'],
            severity: 'warning',
          },
        ],
      };

      expect(impact.affectedProjects).toHaveLength(1);
      expect(impact.affectedProjects[0].impactLevel).toBe('high');
      expect(impact.apiContractChanges).toHaveLength(1);
      expect(impact.apiContractChanges[0].severity).toBe('warning');
    });

    it('AffectedProject 모든 impactLevel 값 검증', () => {
      const levels: AffectedProject['impactLevel'][] = ['low', 'medium', 'high', 'critical'];
      for (const level of levels) {
        const project: AffectedProject = {
          projectId: 'test',
          projectName: 'Test',
          impactLevel: level,
          affectedApis: [],
          affectedComponents: 0,
          summary: '',
        };
        expect(project.impactLevel).toBe(level);
      }
    });

    it('ApiContractChange 모든 changeType/severity 값 검증', () => {
      const changeTypes: ApiContractChange['changeType'][] = ['add', 'modify', 'remove'];
      const severities: ApiContractChange['severity'][] = ['info', 'warning', 'critical'];

      for (const changeType of changeTypes) {
        for (const severity of severities) {
          const change: ApiContractChange = {
            apiPath: '/api/test',
            changeType,
            consumers: [],
            severity,
          };
          expect(change.changeType).toBe(changeType);
          expect(change.severity).toBe(severity);
        }
      }
    });
  });

  // ============================================================
  // detectLinks
  // ============================================================

  describe('detectLinks', () => {
    /** 테스트용 ApiEndpoint 생성 헬퍼 */
    function createTestApi(apiPath: string, method: string = 'GET'): ApiEndpoint {
      return {
        id: `api-${apiPath}`,
        method: method as ApiEndpoint['method'],
        path: apiPath,
        filePath: 'src/api.ts',
        handler: 'handler',
        calledBy: [],
        requestParams: [],
        responseType: 'unknown',
        relatedModels: [],
      };
    }

    /** 테스트용 CodeIndex 생성 헬퍼 */
    function createTestIndex(apis: ApiEndpoint[]): CodeIndex {
      return {
        meta: {
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          gitCommit: 'abc123',
          gitBranch: 'main',
          project: {
            name: 'test',
            path: '/test',
            techStack: [],
            packageManager: 'npm',
          },
          stats: {
            totalFiles: 0,
            screens: 0,
            components: 0,
            apiEndpoints: apis.length,
            models: 0,
            modules: 0,
          },
        },
        files: [],
        screens: [],
        components: [],
        apis,
        models: [],
        policies: [],
        dependencies: { graph: { nodes: [], edges: [] } },
      };
    }

    it('자동 감지 기본 동작 - API 경로 매칭', async () => {
      // provider와 consumer가 같은 API 경로를 가짐
      const providerApis = [createTestApi('/api/users'), createTestApi('/api/products')];
      const consumerApis = [createTestApi('/api/users')];

      const mockIndexer = {
        loadIndex: jest.fn()
          .mockResolvedValueOnce(createTestIndex(providerApis))
          .mockResolvedValueOnce(createTestIndex(consumerApis)),
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['provider', 'consumer']);

      expect(links.length).toBeGreaterThan(0);
      // consumer -> provider 링크가 감지되어야 함
      const link = links.find(l => l.source === 'consumer' && l.target === 'provider');
      expect(link).toBeDefined();
      expect(link!.apis).toContain('/api/users');
    });

    it('API 경로 매칭 - 정확 매칭', async () => {
      const providerApis = [createTestApi('/api/orders'), createTestApi('/api/payments')];
      const consumerApis = [createTestApi('/api/orders'), createTestApi('/api/payments')];

      const mockIndexer = {
        loadIndex: jest.fn()
          .mockResolvedValueOnce(createTestIndex(providerApis))
          .mockResolvedValueOnce(createTestIndex(consumerApis)),
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['backend', 'frontend']);

      expect(links.length).toBeGreaterThan(0);
      const link = links.find(l => l.source === 'frontend' && l.target === 'backend');
      expect(link).toBeDefined();
      expect(link!.apis).toContain('/api/orders');
      expect(link!.apis).toContain('/api/payments');
    });

    it('매칭 없을 때 빈 배열', async () => {
      const providerApis = [createTestApi('/api/users')];
      const consumerApis = [createTestApi('/api/products')];

      const mockIndexer = {
        loadIndex: jest.fn()
          .mockResolvedValueOnce(createTestIndex(providerApis))
          .mockResolvedValueOnce(createTestIndex(consumerApis)),
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['project-a', 'project-b']);

      expect(links).toHaveLength(0);
    });

    it('autoDetected가 true', async () => {
      const sharedApis = [createTestApi('/api/shared')];

      const mockIndexer = {
        loadIndex: jest.fn()
          .mockResolvedValueOnce(createTestIndex(sharedApis))
          .mockResolvedValueOnce(createTestIndex(sharedApis)),
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['project-a', 'project-b']);

      for (const link of links) {
        expect(link.autoDetected).toBe(true);
      }
    });

    it('프로젝트가 2개 미만이면 빈 배열', async () => {
      const mockIndexer = {
        loadIndex: jest.fn(),
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['only-one']);
      expect(links).toHaveLength(0);
      expect(mockIndexer.loadIndex).not.toHaveBeenCalled();
    });

    it('인덱스가 없는 프로젝트는 스킵', async () => {
      const providerApis = [createTestApi('/api/users')];

      const mockIndexer = {
        loadIndex: jest.fn()
          .mockResolvedValueOnce(createTestIndex(providerApis))
          .mockResolvedValueOnce(null), // consumer 인덱스 없음
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['provider', 'consumer']);

      expect(links).toHaveLength(0);
    });

    it('패턴 매칭 - path parameter 치환', async () => {
      const providerApis = [createTestApi('/api/users/:id')];
      const consumerApis = [createTestApi('/api/users/123')];

      const mockIndexer = {
        loadIndex: jest.fn()
          .mockResolvedValueOnce(createTestIndex(providerApis))
          .mockResolvedValueOnce(createTestIndex(consumerApis)),
      } as unknown as Indexer;

      const links = await manager.detectLinks(mockIndexer, ['provider', 'consumer']);

      expect(links.length).toBeGreaterThan(0);
      const link = links.find(l => l.target === 'provider');
      expect(link).toBeDefined();
      expect(link!.apis).toContain('/api/users/:id');
    });
  });
});
