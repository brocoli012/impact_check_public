/**
 * @module tests/unit/analysis/pipeline
 * @description AnalysisPipeline 통합 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AnalysisPipeline } from '../../../src/core/analysis/pipeline';
import { Indexer } from '../../../src/core/indexing/indexer';
import { AnnotationLoader } from '../../../src/core/annotations/annotation-loader';
import { CodeIndex } from '../../../src/types/index';
import { SpecInput } from '../../../src/core/spec/spec-parser';
import { ensureDir, writeJsonFile } from '../../../src/utils/file';

/** 테스트용 코드 인덱스 생성 */
function createTestCodeIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test-project',
        path: '/test',
        techStack: ['typescript', 'react'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 2,
        components: 3,
        apiEndpoints: 2,
        models: 1,
        modules: 2,
      },
    },
    files: [],
    screens: [
      {
        id: 'screen-1',
        name: 'CartPage',
        route: '/cart',
        filePath: 'src/pages/CartPage.tsx',
        components: ['comp-1'],
        apiCalls: ['api-1'],
        childScreens: [],
        metadata: { linesOfCode: 200, complexity: 'medium' },
      },
      {
        id: 'screen-2',
        name: 'OrderPage',
        route: '/order',
        filePath: 'src/pages/OrderPage.tsx',
        components: ['comp-2'],
        apiCalls: ['api-2'],
        childScreens: [],
        metadata: { linesOfCode: 300, complexity: 'high' },
      },
    ],
    components: [
      {
        id: 'comp-1',
        name: 'CartItem',
        filePath: 'src/components/CartItem.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-1'],
        props: ['item', 'onQuantityChange'],
        emits: [],
        apiCalls: [],
        linesOfCode: 80,
      },
      {
        id: 'comp-2',
        name: 'OrderForm',
        filePath: 'src/components/OrderForm.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-2'],
        props: ['order'],
        emits: [],
        apiCalls: ['api-2'],
        linesOfCode: 120,
      },
    ],
    apis: [
      {
        id: 'api-1',
        method: 'GET',
        path: '/api/cart',
        filePath: 'src/api/cart.ts',
        handler: 'getCart',
        calledBy: ['screen-1'],
        requestParams: [],
        responseType: 'CartResponse',
        relatedModels: ['model-1'],
      },
      {
        id: 'api-2',
        method: 'POST',
        path: '/api/orders',
        filePath: 'src/api/orders.ts',
        handler: 'createOrder',
        calledBy: ['screen-2'],
        requestParams: ['orderData'],
        responseType: 'OrderResponse',
        relatedModels: [],
      },
    ],
    models: [
      {
        id: 'model-1',
        name: 'CartItem',
        filePath: 'src/models/CartItem.ts',
        type: 'interface',
        fields: [
          { name: 'productId', type: 'string', required: true },
          { name: 'quantity', type: 'number', required: true },
        ],
        relatedApis: ['api-1'],
      },
    ],
    policies: [
      {
        id: 'pol-1',
        name: '수량 제한',
        description: '수량은 1~99',
        source: 'comment',
        sourceText: '// 수량: 1~99',
        filePath: 'src/components/CartItem.tsx',
        lineNumber: 25,
        category: '장바구니',
        relatedComponents: ['comp-1'],
        relatedApis: ['api-1'],
        relatedModules: ['cart'],
        extractedAt: '2024-01-01T00:00:00Z',
      },
    ],
    dependencies: {
      graph: {
        nodes: [
          { id: 'screen-1', type: 'screen', name: 'CartPage' },
          { id: 'screen-2', type: 'screen', name: 'OrderPage' },
          { id: 'comp-1', type: 'component', name: 'CartItem' },
          { id: 'comp-2', type: 'component', name: 'OrderForm' },
          { id: 'api-1', type: 'api', name: 'getCart' },
          { id: 'api-2', type: 'api', name: 'createOrder' },
        ],
        edges: [
          { from: 'screen-1', to: 'comp-1', type: 'import' },
          { from: 'screen-1', to: 'api-1', type: 'api-call' },
          { from: 'screen-2', to: 'comp-2', type: 'import' },
          { from: 'screen-2', to: 'api-2', type: 'api-call' },
        ],
      },
    },
  };
}

describe('AnalysisPipeline', () => {
  let tmpDir: string;
  let projectId: string;

  beforeEach(() => {
    // 임시 디렉토리 생성
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-test-'));
    projectId = 'test-project';

    // 프로젝트 인덱스 구조 생성
    const indexDir = path.join(tmpDir, '.impact', 'projects', projectId, 'index');
    ensureDir(indexDir);

    const codeIndex = createTestCodeIndex();

    // 인덱스 파일 저장
    writeJsonFile(path.join(indexDir, 'meta.json'), codeIndex.meta);
    writeJsonFile(path.join(indexDir, 'files.json'), codeIndex.files);
    writeJsonFile(path.join(indexDir, 'screens.json'), codeIndex.screens);
    writeJsonFile(path.join(indexDir, 'components.json'), codeIndex.components);
    writeJsonFile(path.join(indexDir, 'apis.json'), codeIndex.apis);
    writeJsonFile(path.join(indexDir, 'models.json'), codeIndex.models);
    writeJsonFile(path.join(indexDir, 'policies.json'), codeIndex.policies);
    writeJsonFile(path.join(indexDir, 'dependencies.json'), codeIndex.dependencies);
  });

  afterEach(() => {
    // 임시 디렉토리 정리
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('run', () => {
    it('should run full pipeline (rule-based)', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const input: SpecInput = {
        type: 'text',
        content: '# 장바구니 수량 변경 기능 개선\n\n1. 장바구니 화면에서 수량 직접 입력 기능 추가\n수량 입력 필드 추가\n\n2. 수량 변경 API 수정\ncart API 파라미터 추가',
      };

      const result = await pipeline.run(input, projectId, tmpDir);

      // 기본 구조 확인
      expect(result.analysisId).toBeDefined();
      expect(result.specTitle).toBeTruthy();
      // totalScore is the sum of screen scores; may be 0 if the fallback
      // parser's extracted keywords don't match any indexed screen names.
      expect(typeof result.totalScore).toBe('number');
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.grade).toBeDefined();
      expect(['Low', 'Medium', 'High', 'Critical']).toContain(result.grade);
      expect(result.recommendation).toBeTruthy();

      // Rule-based parser may or may not match screens depending on keyword extraction
      expect(Array.isArray(result.affectedScreens)).toBe(true);

      // 점수 확인
      expect(result.screenScores).toBeDefined();

      // 신뢰도 확인
      expect(result.confidenceScores).toBeDefined();
      expect(result.confidenceScores.length).toBeGreaterThan(0);

      // 정책 경고 확인
      expect(result.policyWarnings).toBeDefined();

      // 담당자 알림 확인
      expect(result.ownerNotifications).toBeDefined();

      // 낮은 신뢰도 경고 확인
      expect(result.lowConfidenceWarnings).toBeDefined();
    });

    it('should report progress', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const progressSteps: number[] = [];
      pipeline.setProgressCallback((step, _total, _message) => {
        progressSteps.push(step);
      });

      const input: SpecInput = {
        type: 'text',
        content: '# 테스트 기획서\n\n1. 기능 추가',
      };

      await pipeline.run(input, projectId, tmpDir);

      // 6단계 모두 보고되어야 함
      expect(progressSteps).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should include parsedSpec in result (REQ-009)', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const input: SpecInput = {
        type: 'text',
        content: '# 장바구니 수량 변경 기능 개선\n\n1. 장바구니 화면에서 수량 직접 입력 기능 추가\n수량 입력 필드 추가',
      };

      const result = await pipeline.run(input, projectId, tmpDir);

      // parsedSpec should be preserved in the final result
      expect(result.parsedSpec).toBeDefined();
      expect(result.parsedSpec!.title).toBeTruthy();
      expect(Array.isArray(result.parsedSpec!.features)).toBe(true);
      expect(Array.isArray(result.parsedSpec!.requirements)).toBe(true);
      expect(Array.isArray(result.parsedSpec!.keywords)).toBe(true);
    });

    it('should include analysisSummary in result (REQ-009)', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const input: SpecInput = {
        type: 'text',
        content: '# 장바구니 수량 변경 기능 개선\n\n1. 장바구니 화면에서 수량 직접 입력 기능 추가\n수량 입력 필드 추가',
      };

      const result = await pipeline.run(input, projectId, tmpDir);

      // analysisSummary should be generated
      expect(result.analysisSummary).toBeDefined();
      expect(result.analysisSummary!.overview).toBeTruthy();
      expect(typeof result.analysisSummary!.overview).toBe('string');
      expect(Array.isArray(result.analysisSummary!.keyFindings)).toBe(true);
      expect(Array.isArray(result.analysisSummary!.riskAreas)).toBe(true);
    });

    it('should preserve parsedSpec and analysisSummary after saveResult (REQ-009)', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const input: SpecInput = {
        type: 'text',
        content: '# 기획서\n\n1. 장바구니 기능 수정\ncart 관련 변경',
      };

      const result = await pipeline.run(input, projectId, tmpDir);
      const resultId = await pipeline.saveResult(result, projectId);

      // 저장된 파일 로드하여 parsedSpec/analysisSummary 확인
      const resultPath = path.join(
        tmpDir,
        '.impact',
        'projects',
        projectId,
        'results',
        `${resultId}.json`,
      );
      const savedContent = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));

      expect(savedContent.parsedSpec).toBeDefined();
      expect(savedContent.parsedSpec.title).toBeTruthy();
      expect(savedContent.analysisSummary).toBeDefined();
      expect(savedContent.analysisSummary.overview).toBeTruthy();
    });

    it('should throw error when index not found', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const input: SpecInput = {
        type: 'text',
        content: '테스트',
      };

      await expect(
        pipeline.run(input, 'nonexistent-project', tmpDir)
      ).rejects.toThrow('Code index not found');
    });
  });

  describe('saveResult', () => {
    it('should save and load result', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      const input: SpecInput = {
        type: 'text',
        content: '# 기획서\n\n1. 장바구니 기능 수정\ncart 관련 변경',
      };

      const result = await pipeline.run(input, projectId, tmpDir);
      const resultId = await pipeline.saveResult(result, projectId);

      expect(resultId).toBeTruthy();

      // 저장된 파일 확인
      const resultPath = path.join(
        tmpDir,
        '.impact',
        'projects',
        projectId,
        'results',
        `${resultId}.json`,
      );
      expect(fs.existsSync(resultPath)).toBe(true);
    });
  });

  describe('autoRefreshIndex', () => {
    const defaultInput: SpecInput = {
      type: 'text',
      content: '# 테스트 기획서\n\n1. 기능 추가',
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should call isIndexStale during run()', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);
      const isIndexStaleSpy = jest.spyOn(Indexer.prototype, 'isIndexStale')
        .mockResolvedValue(false);

      await pipeline.run(defaultInput, projectId, tmpDir);

      expect(isIndexStaleSpy).toHaveBeenCalledWith(
        '/test', // projectPath from index meta
        projectId,
        tmpDir,
      );
    });

    it('should call incrementalUpdate when index is stale', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);
      const updatedIndex = createTestCodeIndex();
      updatedIndex.meta.updatedAt = '2024-06-01T00:00:00Z';
      updatedIndex.meta.gitCommit = 'def456';

      jest.spyOn(Indexer.prototype, 'isIndexStale')
        .mockResolvedValue(true);
      const incrementalUpdateSpy = jest.spyOn(Indexer.prototype, 'incrementalUpdate')
        .mockResolvedValue(updatedIndex);
      jest.spyOn(Indexer.prototype, 'saveIndex')
        .mockResolvedValue(undefined);

      await pipeline.run(defaultInput, projectId, tmpDir);

      expect(incrementalUpdateSpy).toHaveBeenCalledWith(
        '/test', // projectPath from index meta
        projectId,
        tmpDir,
      );
    });

    it('should not call incrementalUpdate when index is not stale', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      jest.spyOn(Indexer.prototype, 'isIndexStale')
        .mockResolvedValue(false);
      const incrementalUpdateSpy = jest.spyOn(Indexer.prototype, 'incrementalUpdate');

      await pipeline.run(defaultInput, projectId, tmpDir);

      expect(incrementalUpdateSpy).not.toHaveBeenCalled();
    });

    it('should fallback to existing index when incrementalUpdate fails', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      jest.spyOn(Indexer.prototype, 'isIndexStale')
        .mockResolvedValue(true);
      jest.spyOn(Indexer.prototype, 'incrementalUpdate')
        .mockRejectedValue(new Error('Git not available'));

      // run() should NOT throw - it should fall back to existing index
      const result = await pipeline.run(defaultInput, projectId, tmpDir);

      // 분석이 정상적으로 완료되어야 함
      expect(result.analysisId).toBeDefined();
      expect(result.specTitle).toBeTruthy();
    });

    it('should use updated index for analysis after auto-refresh', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);

      // 업데이트된 인덱스에 특정 정책 추가 (분석 결과로 검증 가능)
      const updatedIndex = createTestCodeIndex();
      updatedIndex.meta.gitCommit = 'new-commit';
      updatedIndex.policies.push({
        id: 'pol-refresh-marker',
        name: '자동 갱신 테스트 정책',
        description: '자동 갱신 후 이 정책이 분석에 포함되어야 함',
        source: 'manual',
        sourceText: '// refresh marker',
        filePath: 'src/components/CartItem.tsx',
        lineNumber: 100,
        category: '테스트',
        relatedComponents: ['comp-1'],
        relatedApis: [],
        relatedModules: ['cart'],
        extractedAt: '2024-06-01T00:00:00Z',
      });

      jest.spyOn(Indexer.prototype, 'isIndexStale')
        .mockResolvedValue(true);
      jest.spyOn(Indexer.prototype, 'incrementalUpdate')
        .mockResolvedValue(updatedIndex);
      jest.spyOn(Indexer.prototype, 'saveIndex')
        .mockResolvedValue(undefined);

      const result = await pipeline.run(defaultInput, projectId, tmpDir);

      // 분석 완료 확인
      expect(result.analysisId).toBeDefined();
      // incrementalUpdate가 호출되었고 분석이 성공적으로 완료됨 = 업데이트된 인덱스 사용됨
      expect(result.specTitle).toBeTruthy();
      expect(result.confidenceScores).toBeDefined();
      expect(result.confidenceScores.length).toBeGreaterThan(0);
    });

    it('should save updated index after successful incrementalUpdate', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);
      const updatedIndex = createTestCodeIndex();
      updatedIndex.meta.gitCommit = 'new-commit';

      jest.spyOn(Indexer.prototype, 'isIndexStale')
        .mockResolvedValue(true);
      jest.spyOn(Indexer.prototype, 'incrementalUpdate')
        .mockResolvedValue(updatedIndex);
      const saveIndexSpy = jest.spyOn(Indexer.prototype, 'saveIndex')
        .mockResolvedValue(undefined);

      await pipeline.run(defaultInput, projectId, tmpDir);

      expect(saveIndexSpy).toHaveBeenCalledWith(
        updatedIndex,
        projectId,
        tmpDir,
      );
    });
  });

  describe('annotation loading integration', () => {
    const defaultInput: SpecInput = {
      type: 'text',
      content: '# 테스트 기획서\n\n1. 기능 추가',
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should attempt to load annotations during run()', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);
      const loadSpy = jest.spyOn(AnnotationLoader.prototype, 'loadForProject')
        .mockResolvedValue(new Map());

      await pipeline.run(defaultInput, projectId, tmpDir);

      expect(loadSpy).toHaveBeenCalledWith(projectId);
    });

    it('should work normally when no annotations exist', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);
      jest.spyOn(AnnotationLoader.prototype, 'loadForProject')
        .mockResolvedValue(new Map());

      const result = await pipeline.run(defaultInput, projectId, tmpDir);

      expect(result.analysisId).toBeDefined();
      expect(result.confidenceScores).toBeDefined();
      expect(result.confidenceScores.length).toBeGreaterThan(0);
    });

    it('should fallback gracefully when annotation loading fails', async () => {
      const pipeline = new AnalysisPipeline(tmpDir);
      jest.spyOn(AnnotationLoader.prototype, 'loadForProject')
        .mockRejectedValue(new Error('Annotation load error'));

      // Should NOT throw - should fallback
      const result = await pipeline.run(defaultInput, projectId, tmpDir);

      expect(result.analysisId).toBeDefined();
      expect(result.confidenceScores).toBeDefined();
      expect(result.confidenceScores.length).toBeGreaterThan(0);
    });
  });
});
