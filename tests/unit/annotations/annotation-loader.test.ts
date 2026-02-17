/**
 * @module tests/unit/annotations/annotation-loader
 * @description AnnotationLoader 단위 테스트
 *
 * 프로젝트/파일 단위 보강 주석 로드, 필터링, Layer 3 신뢰도 보너스 계산,
 * 메타 정보 조회 기능을 검증합니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AnnotationLoader } from '../../../src/core/annotations/annotation-loader';
import { AnnotationManager } from '../../../src/core/annotations/annotation-manager';
import { AnnotationFile, FunctionAnnotation } from '../../../src/types/annotations';

// ============================================================
// 테스트 헬퍼
// ============================================================

/** 테스트용 FunctionAnnotation 생성 */
function createTestAnnotation(overrides?: Partial<FunctionAnnotation>): FunctionAnnotation {
  return {
    line: 10,
    endLine: 25,
    function: 'calculateShipping',
    signature: 'calculateShipping(order: Order): number',
    original_comment: null,
    enriched_comment: '배송비를 계산합니다.',
    confidence: 0.85,
    type: 'business_logic',
    userModified: false,
    lastModifiedBy: null,
    inferred_from: 'function body analysis',
    policies: [
      {
        name: '배송비 정책',
        description: '주문 금액에 따라 배송비를 결정합니다.',
        confidence: 0.9,
        category: '배송',
        inferred_from: 'conditional logic',
      },
    ],
    relatedFunctions: [],
    relatedApis: [],
    ...overrides,
  };
}

/** 테스트용 AnnotationFile 생성 */
function createTestAnnotationFile(overrides?: Partial<AnnotationFile>): AnnotationFile {
  return {
    file: 'src/services/shipping.ts',
    system: 'delivery',
    lastAnalyzed: '2026-02-17T10:00:00Z',
    sourceHash: 'abc123def456',
    analyzerVersion: '1.0.0',
    model: 'rule-based',
    fileSummary: {
      description: '배송 관련 서비스 로직',
      confidence: 0.8,
      businessDomain: '배송',
      keywords: ['배송', '배송비'],
    },
    annotations: [createTestAnnotation()],
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('AnnotationLoader', () => {
  let tmpDir: string;
  let loader: AnnotationLoader;
  let manager: AnnotationManager;
  const projectId = 'test-project';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-loader-test-'));
    loader = new AnnotationLoader(tmpDir);
    manager = new AnnotationManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================
  // loadForProject
  // ==========================================================

  describe('loadForProject', () => {
    it('should load all annotations for a project', async () => {
      const ann1 = createTestAnnotationFile({ file: 'src/services/shipping.ts' });
      const ann2 = createTestAnnotationFile({ file: 'src/services/payment.ts', system: 'payment' });

      await manager.save(projectId, ann1.file, ann1);
      await manager.save(projectId, ann2.file, ann2);

      const result = await loader.loadForProject(projectId);

      expect(result.size).toBe(2);
      expect(result.has('src/services/shipping.ts')).toBe(true);
      expect(result.has('src/services/payment.ts')).toBe(true);
    });

    it('should return empty map for non-existent project', async () => {
      const result = await loader.loadForProject('non-existent');
      expect(result.size).toBe(0);
    });
  });

  // ==========================================================
  // loadForFile
  // ==========================================================

  describe('loadForFile', () => {
    it('should load annotation for a single file', async () => {
      const ann = createTestAnnotationFile({ file: 'src/services/shipping.ts' });
      await manager.save(projectId, ann.file, ann);

      const result = await loader.loadForFile(projectId, 'src/services/shipping.ts');

      expect(result).not.toBeNull();
      expect(result!.file).toBe('src/services/shipping.ts');
      expect(result!.annotations).toHaveLength(1);
    });

    it('should return null when file does not exist', async () => {
      const result = await loader.loadForFile(projectId, 'non/existent/file.ts');
      expect(result).toBeNull();
    });
  });

  // ==========================================================
  // loadForFiles
  // ==========================================================

  describe('loadForFiles', () => {
    it('should load annotations for specified file list only', async () => {
      const ann1 = createTestAnnotationFile({ file: 'src/services/shipping.ts' });
      const ann2 = createTestAnnotationFile({ file: 'src/services/payment.ts' });
      const ann3 = createTestAnnotationFile({ file: 'src/services/order.ts' });

      await manager.save(projectId, ann1.file, ann1);
      await manager.save(projectId, ann2.file, ann2);
      await manager.save(projectId, ann3.file, ann3);

      const result = await loader.loadForFiles(projectId, [
        'src/services/shipping.ts',
        'src/services/order.ts',
      ]);

      expect(result.size).toBe(2);
      expect(result.has('src/services/shipping.ts')).toBe(true);
      expect(result.has('src/services/order.ts')).toBe(true);
      expect(result.has('src/services/payment.ts')).toBe(false);
    });

    it('should skip files that do not have annotations', async () => {
      const ann1 = createTestAnnotationFile({ file: 'src/services/shipping.ts' });
      await manager.save(projectId, ann1.file, ann1);

      const result = await loader.loadForFiles(projectId, [
        'src/services/shipping.ts',
        'src/services/nonexistent.ts',
      ]);

      expect(result.size).toBe(1);
      expect(result.has('src/services/shipping.ts')).toBe(true);
    });
  });

  // ==========================================================
  // calculateConfidenceBonus
  // ==========================================================

  describe('calculateConfidenceBonus', () => {
    it('should return 0 when no annotations', () => {
      const empty = new Map<string, AnnotationFile>();
      const bonus = loader.calculateConfidenceBonus(empty);
      expect(bonus).toBe(0);
    });

    it('should return +15 for annotation existence', () => {
      const map = new Map<string, AnnotationFile>();
      map.set('file.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.3,
            policies: [],
            userModified: false,
          }),
        ],
      }));

      const bonus = loader.calculateConfidenceBonus(map);
      // 존재(+15), 평균 confidence 0.3 < 0.7(+0), policies 0 < 5(+0), no userModified(+0)
      expect(bonus).toBe(15);
    });

    it('should add +10 when average confidence >= 0.7', () => {
      const map = new Map<string, AnnotationFile>();
      map.set('file.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.8,
            policies: [],
            userModified: false,
          }),
        ],
      }));

      const bonus = loader.calculateConfidenceBonus(map);
      // 존재(+15), 평균 confidence 0.8 >= 0.7(+10), policies 0 < 5(+0), no userModified(+0)
      expect(bonus).toBe(25);
    });

    it('should add +10 when total policies >= 5', () => {
      const policies = Array.from({ length: 5 }, (_, i) => ({
        name: `policy-${i}`,
        description: 'test',
        confidence: 0.5,
        category: 'test',
        inferred_from: 'test',
      }));

      const map = new Map<string, AnnotationFile>();
      map.set('file.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.3,
            policies,
            userModified: false,
          }),
        ],
      }));

      const bonus = loader.calculateConfidenceBonus(map);
      // 존재(+15), 평균 confidence 0.3 < 0.7(+0), policies 5 >= 5(+10), no userModified(+0)
      expect(bonus).toBe(25);
    });

    it('should add +5 when userModified exists', () => {
      const map = new Map<string, AnnotationFile>();
      map.set('file.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.3,
            policies: [],
            userModified: true,
          }),
        ],
      }));

      const bonus = loader.calculateConfidenceBonus(map);
      // 존재(+15), 평균 confidence 0.3 < 0.7(+0), policies 0 < 5(+0), userModified(+5)
      expect(bonus).toBe(20);
    });

    it('should return maximum 40 when all conditions met', () => {
      const policies = Array.from({ length: 6 }, (_, i) => ({
        name: `policy-${i}`,
        description: 'test',
        confidence: 0.8,
        category: 'test',
        inferred_from: 'test',
      }));

      const map = new Map<string, AnnotationFile>();
      map.set('file1.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.9,
            policies,
            userModified: true,
          }),
        ],
      }));
      map.set('file2.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.8,
            policies: [],
            userModified: false,
          }),
        ],
      }));

      const bonus = loader.calculateConfidenceBonus(map);
      // 존재(+15), 평균 (0.9+0.8)/2=0.85 >= 0.7(+10), policies 6 >= 5(+10), userModified(+5) = 40
      expect(bonus).toBe(40);
    });

    it('should cap at 40 even if all bonuses exceed', () => {
      // This scenario is the same as above since max is exactly 40
      const policies = Array.from({ length: 10 }, (_, i) => ({
        name: `policy-${i}`,
        description: 'test',
        confidence: 0.9,
        category: 'test',
        inferred_from: 'test',
      }));

      const map = new Map<string, AnnotationFile>();
      map.set('file.ts', createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            confidence: 0.95,
            policies,
            userModified: true,
          }),
        ],
      }));

      const bonus = loader.calculateConfidenceBonus(map);
      expect(bonus).toBeLessThanOrEqual(40);
      expect(bonus).toBe(40);
    });
  });

  // ==========================================================
  // getProjectMeta
  // ==========================================================

  describe('getProjectMeta', () => {
    it('should return meta information after updateMeta', async () => {
      const ann = createTestAnnotationFile();
      await manager.save(projectId, ann.file, ann);
      await manager.updateMeta(projectId);

      const meta = await loader.getProjectMeta(projectId);

      expect(meta).not.toBeNull();
      expect(meta!.totalFiles).toBe(1);
      expect(meta!.totalAnnotations).toBe(1);
      expect(meta!.version).toBe('1.0.0');
    });

    it('should return null when no meta exists', async () => {
      const meta = await loader.getProjectMeta('non-existent');
      expect(meta).toBeNull();
    });
  });
});
