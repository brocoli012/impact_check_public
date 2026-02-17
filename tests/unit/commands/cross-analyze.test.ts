/**
 * @module tests/unit/commands/cross-analyze
 * @description CrossAnalyzeCommand 단위 테스트
 *
 * 명령어 속성, 옵션 파싱, 분석 결과 출력, 에러 처리를 검증합니다.
 */

import { CrossAnalyzeCommand } from '../../../src/commands/cross-analyze';
import { ResultCode } from '../../../src/types/common';
import { CrossProjectManager } from '../../../src/core/cross-project/cross-project-manager';
import { CrossAnalyzer } from '../../../src/core/cross-project/cross-analyzer';
import { ConfigManager } from '../../../src/config/config-manager';
import { route, getAvailableCommands } from '../../../src/router';

// Mock dependencies
jest.mock('../../../src/core/cross-project/cross-project-manager');
jest.mock('../../../src/core/cross-project/api-contract-checker');
jest.mock('../../../src/core/cross-project/cross-analyzer');
jest.mock('../../../src/core/indexing/indexer');
jest.mock('../../../src/config/config-manager');
// Note: ApiContractChecker and Indexer are mocked above for internal usage by CrossAnalyzeCommand
jest.mock('../../../src/utils/file', () => ({
  readJsonFile: jest.fn(),
  getImpactDir: jest.fn().mockReturnValue('/tmp/.impact'),
  getProjectDir: jest.fn().mockReturnValue('/tmp/.impact/projects/test-project'),
}));

const MockManager = CrossProjectManager as jest.MockedClass<typeof CrossProjectManager>;
const MockAnalyzer = CrossAnalyzer as jest.MockedClass<typeof CrossAnalyzer>;
const MockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;

// ============================================================
// Tests
// ============================================================

describe('CrossAnalyzeCommand', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Default ConfigManager mock
    MockConfigManager.prototype.load.mockResolvedValue(undefined);
    MockConfigManager.prototype.getActiveProject.mockReturnValue('test-project');

    // Default Manager mock - links exist
    MockManager.prototype.getLinks.mockResolvedValue([
      {
        id: 'test-project-other',
        source: 'test-project',
        target: 'other',
        type: 'api-consumer',
        autoDetected: false,
      },
    ]);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ============================================================
  // name, description 속성
  // ============================================================

  describe('name, description 속성', () => {
    it('name은 cross-analyze이다', () => {
      const cmd = new CrossAnalyzeCommand([]);
      expect(cmd.name).toBe('cross-analyze');
    });

    it('description이 존재한다', () => {
      const cmd = new CrossAnalyzeCommand([]);
      expect(cmd.description).toBeTruthy();
      expect(typeof cmd.description).toBe('string');
    });
  });

  // ============================================================
  // 기본 실행: 분석 결과 출력
  // ============================================================

  describe('기본 실행', () => {
    it('분석 결과를 출력하고 SUCCESS를 반환한다', async () => {
      MockAnalyzer.prototype.analyze.mockResolvedValue({
        affectedProjects: [
          {
            projectId: 'frontend',
            projectName: 'Frontend App',
            impactLevel: 'high',
            affectedApis: ['/api/users'],
            affectedComponents: 3,
            summary: 'API 계약 변경 1건, 공유 API 1개',
          },
        ],
        apiContractChanges: [
          {
            apiPath: '/api/users',
            changeType: 'modify',
            consumers: ['frontend'],
            severity: 'warning',
          },
        ],
      });

      const cmd = new CrossAnalyzeCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.data).toBeDefined();
    });
  });

  // ============================================================
  // --source 옵션
  // ============================================================

  describe('--source 옵션', () => {
    it('--source로 소스 프로젝트를 지정할 수 있다', async () => {
      MockAnalyzer.prototype.analyze.mockResolvedValue({
        affectedProjects: [],
        apiContractChanges: [],
      });

      MockManager.prototype.getLinks.mockResolvedValue([
        {
          id: 'backend-api-frontend',
          source: 'backend-api',
          target: 'frontend',
          type: 'api-consumer',
          autoDetected: false,
        },
      ]);

      const cmd = new CrossAnalyzeCommand(['--source', 'backend-api']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      // CrossAnalyzer.analyze가 호출되었는지 확인
      expect(MockAnalyzer.prototype.analyze).toHaveBeenCalled();
    });
  });

  // ============================================================
  // --group 옵션
  // ============================================================

  describe('--group 옵션', () => {
    it('--group으로 특정 그룹 대상 분석이 가능하다', async () => {
      MockAnalyzer.prototype.analyze.mockResolvedValue({
        affectedProjects: [],
        apiContractChanges: [],
      });

      const cmd = new CrossAnalyzeCommand(['--group', 'commerce']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(MockAnalyzer.prototype.analyze).toHaveBeenCalledWith(
        'test-project',
        expect.any(Object),
        { groupName: 'commerce' },
      );
    });
  });

  // ============================================================
  // 링크 없을 때 안내
  // ============================================================

  describe('링크 없을 때 안내', () => {
    it('의존성이 없으면 안내 메시지를 출력한다', async () => {
      MockManager.prototype.getLinks.mockResolvedValue([]);

      const cmd = new CrossAnalyzeCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('의존성이 없습니다');
    });
  });

  // ============================================================
  // 프로젝트 미설정 시 에러
  // ============================================================

  describe('프로젝트 미설정 시 에러', () => {
    it('활성 프로젝트가 없고 --source도 없으면 NEEDS_CONFIG를 반환한다', async () => {
      MockConfigManager.prototype.getActiveProject.mockReturnValue(null);

      const cmd = new CrossAnalyzeCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
    });
  });

  // ============================================================
  // Router 등록 확인
  // ============================================================

  describe('Router 등록 확인', () => {
    it('cross-analyze가 사용 가능한 명령어에 포함된다', () => {
      const commands = getAvailableCommands();
      expect(commands).toContain('cross-analyze');
    });

    it('route로 CrossAnalyzeCommand를 생성할 수 있다', () => {
      const cmd = route(['cross-analyze']);
      expect(cmd.name).toBe('cross-analyze');
    });

    it('route로 옵션과 함께 CrossAnalyzeCommand를 생성할 수 있다', () => {
      const cmd = route(['cross-analyze', '--source', 'backend']);
      expect(cmd.name).toBe('cross-analyze');
    });
  });
});
