/**
 * @module tests/unit/cross-project/api-contract-checker
 * @description ApiContractChecker 단위 테스트
 */

import { ApiContractChecker } from '../../../src/core/cross-project/api-contract-checker';
import { ApiEndpoint } from '../../../src/types/index';
import { ApiContractChange } from '../../../src/core/cross-project/types';

/** 테스트용 ApiEndpoint 헬퍼 */
function createApi(overrides: Partial<ApiEndpoint> & { path: string }): ApiEndpoint {
  return {
    id: `api-${overrides.path}`,
    method: 'GET',
    filePath: 'src/api.ts',
    handler: 'handler',
    calledBy: [],
    requestParams: [],
    responseType: 'unknown',
    relatedModels: [],
    ...overrides,
  };
}

describe('ApiContractChecker', () => {
  let checker: ApiContractChecker;

  beforeEach(() => {
    checker = new ApiContractChecker();
  });

  // ============================================================
  // checkContracts
  // ============================================================

  describe('checkContracts', () => {
    it('previousProviderApis 없으면 빈 배열', async () => {
      const providerApis = [createApi({ path: '/api/users' })];
      const consumerApis = [createApi({ path: '/api/users' })];

      const changes = await checker.checkContracts(providerApis, consumerApis);
      expect(changes).toEqual([]);
    });

    it('변경 없을 때 빈 배열', async () => {
      const currentApis = [
        createApi({ path: '/api/users', method: 'GET' }),
        createApi({ path: '/api/products', method: 'POST' }),
      ];
      const previousApis = [
        createApi({ path: '/api/users', method: 'GET' }),
        createApi({ path: '/api/products', method: 'POST' }),
      ];
      const consumerApis = [createApi({ path: '/api/users' })];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);
      expect(changes).toEqual([]);
    });

    it('새 API 추가 감지 (info)', async () => {
      const currentApis = [
        createApi({ path: '/api/users' }),
        createApi({ path: '/api/orders' }),
      ];
      const previousApis = [
        createApi({ path: '/api/users' }),
      ];
      const consumerApis = [createApi({ path: '/api/users' })];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].apiPath).toBe('/api/orders');
      expect(changes[0].changeType).toBe('add');
      expect(changes[0].severity).toBe('info');
    });

    it('API 삭제 감지 (critical - consumer 있을 때)', async () => {
      const currentApis: ApiEndpoint[] = [];
      const previousApis = [
        createApi({ path: '/api/users' }),
      ];
      const consumerApis = [createApi({ path: '/api/users' })];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].apiPath).toBe('/api/users');
      expect(changes[0].changeType).toBe('remove');
      expect(changes[0].severity).toBe('critical');
      expect(changes[0].consumers).toContain('consumer');
    });

    it('API 삭제 감지 (warning - consumer 없을 때)', async () => {
      const currentApis: ApiEndpoint[] = [];
      const previousApis = [
        createApi({ path: '/api/users' }),
      ];
      const consumerApis: ApiEndpoint[] = [];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].apiPath).toBe('/api/users');
      expect(changes[0].changeType).toBe('remove');
      expect(changes[0].severity).toBe('warning');
      expect(changes[0].consumers).toHaveLength(0);
    });

    it('API 수정 감지 (warning) - method 변경', async () => {
      const currentApis = [
        createApi({ path: '/api/users', method: 'POST' }),
      ];
      const previousApis = [
        createApi({ path: '/api/users', method: 'GET' }),
      ];
      const consumerApis = [createApi({ path: '/api/users' })];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].apiPath).toBe('/api/users');
      expect(changes[0].changeType).toBe('modify');
      expect(changes[0].severity).toBe('warning');
    });

    it('API 수정 감지 (warning) - requestParams 변경', async () => {
      const currentApis = [
        createApi({ path: '/api/users', requestParams: ['name', 'email'] }),
      ];
      const previousApis = [
        createApi({ path: '/api/users', requestParams: ['name'] }),
      ];
      const consumerApis = [createApi({ path: '/api/users' })];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('modify');
      expect(changes[0].severity).toBe('warning');
    });

    it('API 수정 감지 (warning) - responseType 변경', async () => {
      const currentApis = [
        createApi({ path: '/api/users', responseType: 'UserResponse' }),
      ];
      const previousApis = [
        createApi({ path: '/api/users', responseType: 'unknown' }),
      ];
      const consumerApis: ApiEndpoint[] = [];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('modify');
      expect(changes[0].severity).toBe('warning');
    });

    it('consumer 목록 포함 (consumer가 사용하는 경우)', async () => {
      const currentApis: ApiEndpoint[] = [];
      const previousApis = [
        createApi({ path: '/api/products' }),
      ];
      const consumerApis = [
        createApi({ path: '/api/products' }),
      ];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      expect(changes).toHaveLength(1);
      expect(changes[0].consumers).toContain('consumer');
    });

    it('여러 변경 동시 감지', async () => {
      const currentApis = [
        createApi({ path: '/api/users', method: 'PUT' }),
        createApi({ path: '/api/orders' }),
        // /api/products 삭제됨
      ];
      const previousApis = [
        createApi({ path: '/api/users', method: 'GET' }),
        createApi({ path: '/api/products' }),
      ];
      const consumerApis = [
        createApi({ path: '/api/users' }),
        createApi({ path: '/api/products' }),
      ];

      const changes = await checker.checkContracts(currentApis, consumerApis, previousApis);

      // 1. /api/orders 추가 (info)
      // 2. /api/products 삭제 (critical - consumer 있음)
      // 3. /api/users 수정 (warning)
      expect(changes).toHaveLength(3);

      const addChange = changes.find(c => c.changeType === 'add');
      expect(addChange).toBeDefined();
      expect(addChange!.apiPath).toBe('/api/orders');

      const removeChange = changes.find(c => c.changeType === 'remove');
      expect(removeChange).toBeDefined();
      expect(removeChange!.apiPath).toBe('/api/products');
      expect(removeChange!.severity).toBe('critical');

      const modifyChange = changes.find(c => c.changeType === 'modify');
      expect(modifyChange).toBeDefined();
      expect(modifyChange!.apiPath).toBe('/api/users');
    });
  });

  // ============================================================
  // classifySeverity
  // ============================================================

  describe('classifySeverity', () => {
    it('add -> info', () => {
      const change: ApiContractChange = {
        apiPath: '/api/test',
        changeType: 'add',
        consumers: [],
        severity: 'info',
      };

      expect(checker.classifySeverity(change)).toBe('info');
    });

    it('add (with consumers) -> info', () => {
      const change: ApiContractChange = {
        apiPath: '/api/test',
        changeType: 'add',
        consumers: ['project-a'],
        severity: 'info',
      };

      expect(checker.classifySeverity(change)).toBe('info');
    });

    it('remove (with consumers) -> critical', () => {
      const change: ApiContractChange = {
        apiPath: '/api/test',
        changeType: 'remove',
        consumers: ['project-a'],
        severity: 'info',
      };

      expect(checker.classifySeverity(change)).toBe('critical');
    });

    it('remove (no consumers) -> warning', () => {
      const change: ApiContractChange = {
        apiPath: '/api/test',
        changeType: 'remove',
        consumers: [],
        severity: 'info',
      };

      expect(checker.classifySeverity(change)).toBe('warning');
    });

    it('modify -> warning', () => {
      const change: ApiContractChange = {
        apiPath: '/api/test',
        changeType: 'modify',
        consumers: [],
        severity: 'info',
      };

      expect(checker.classifySeverity(change)).toBe('warning');
    });

    it('modify (with consumers) -> warning', () => {
      const change: ApiContractChange = {
        apiPath: '/api/test',
        changeType: 'modify',
        consumers: ['project-a', 'project-b'],
        severity: 'info',
      };

      expect(checker.classifySeverity(change)).toBe('warning');
    });
  });
});
