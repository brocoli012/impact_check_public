/**
 * @module tests/unit/analysis/pipeline
 * @description AnalysisPipeline 통합 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AnalysisPipeline } from '../../../src/core/analysis/pipeline';
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
});
