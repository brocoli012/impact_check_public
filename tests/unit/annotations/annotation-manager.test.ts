/**
 * @module tests/unit/annotations/annotation-manager
 * @description AnnotationManager 단위 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { AnnotationManager } from '../../../src/core/annotations/annotation-manager';
import { AnnotationFile, FunctionAnnotation } from '../../../src/types/annotations';

/** 테스트용 보강 주석 데이터 생성 헬퍼 */
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
    relatedFunctions: ['getOrderTotal'],
    relatedApis: ['/api/shipping'],
    ...overrides,
  };
}

/** 테스트용 AnnotationFile 데이터 생성 헬퍼 */
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
      keywords: ['배송', '배송비', '무료배송'],
    },
    annotations: [createTestAnnotation()],
    ...overrides,
  };
}

describe('AnnotationManager', () => {
  let tmpDir: string;
  let manager: AnnotationManager;
  const projectId = 'test-project';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-test-'));
    manager = new AnnotationManager(tmpDir);
  });

  afterEach(() => {
    // 임시 디렉토리 재귀 삭제
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================
  // save / load 기본 동작
  // ==========================================================

  describe('save() / load()', () => {
    it('should save and load an annotation file correctly', async () => {
      const annotation = createTestAnnotationFile();

      await manager.save(projectId, annotation.file, annotation);
      const loaded = await manager.load(projectId, annotation.file);

      expect(loaded).not.toBeNull();
      expect(loaded!.file).toBe(annotation.file);
      expect(loaded!.system).toBe(annotation.system);
      expect(loaded!.sourceHash).toBe(annotation.sourceHash);
      expect(loaded!.annotations).toHaveLength(1);
      expect(loaded!.annotations[0].function).toBe('calculateShipping');
    });

    it('should create directory structure automatically', async () => {
      const annotation = createTestAnnotationFile({
        file: 'src/deep/nested/path/service.ts',
      });

      await manager.save(projectId, annotation.file, annotation);

      const expectedPath = path.join(
        tmpDir,
        'annotations',
        projectId,
        'src/deep/nested/path/service.ts.annotations.yaml'
      );
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should return null when loading non-existent file', async () => {
      const loaded = await manager.load(projectId, 'non/existent/file.ts');
      expect(loaded).toBeNull();
    });

    it('should serialize and deserialize YAML correctly', async () => {
      const annotation = createTestAnnotationFile();

      await manager.save(projectId, annotation.file, annotation);

      // YAML 파일 직접 읽어서 확인
      const annotationPath = path.join(
        tmpDir,
        'annotations',
        projectId,
        `${annotation.file}.annotations.yaml`
      );
      const rawContent = fs.readFileSync(annotationPath, 'utf-8');
      const parsed = yaml.load(rawContent) as AnnotationFile;

      expect(parsed.file).toBe(annotation.file);
      expect(parsed.annotations[0].confidence).toBe(0.85);
      expect(parsed.annotations[0].policies).toHaveLength(1);
      expect(parsed.annotations[0].policies[0].name).toBe('배송비 정책');
    });

    it('should preserve all fields through save/load cycle', async () => {
      const annotation = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            userModified: true,
            lastModifiedBy: 'user@example.com',
            policies: [
              {
                name: '무료배송 정책',
                description: '일정 금액 이상 주문 시 무료배송',
                confidence: 0.95,
                category: '배송',
                inferred_from: 'threshold check',
              },
              {
                name: '도서산간 추가배송비',
                description: '도서산간 지역 추가 배송비',
                confidence: 0.7,
                category: '배송',
                inferred_from: 'region check',
              },
            ],
          }),
        ],
      });

      await manager.save(projectId, annotation.file, annotation);
      const loaded = await manager.load(projectId, annotation.file);

      expect(loaded!.annotations[0].userModified).toBe(true);
      expect(loaded!.annotations[0].lastModifiedBy).toBe('user@example.com');
      expect(loaded!.annotations[0].policies).toHaveLength(2);
      expect(loaded!.fileSummary.keywords).toEqual(['배송', '배송비', '무료배송']);
    });
  });

  // ==========================================================
  // loadAll
  // ==========================================================

  describe('loadAll()', () => {
    it('should load all annotation files in a project', async () => {
      const annotation1 = createTestAnnotationFile({
        file: 'src/services/shipping.ts',
      });
      const annotation2 = createTestAnnotationFile({
        file: 'src/services/payment.ts',
        system: 'payment',
      });

      await manager.save(projectId, annotation1.file, annotation1);
      await manager.save(projectId, annotation2.file, annotation2);

      const allAnnotations = await manager.loadAll(projectId);

      expect(allAnnotations.size).toBe(2);
      expect(allAnnotations.has('src/services/shipping.ts')).toBe(true);
      expect(allAnnotations.has('src/services/payment.ts')).toBe(true);
    });

    it('should return empty map for non-existent project', async () => {
      const result = await manager.loadAll('non-existent-project');
      expect(result.size).toBe(0);
    });
  });

  // ==========================================================
  // isChanged - sourceHash 비교
  // ==========================================================

  describe('isChanged()', () => {
    it('should return false when sourceHash matches', async () => {
      const annotation = createTestAnnotationFile({
        sourceHash: 'hash123',
      });
      await manager.save(projectId, annotation.file, annotation);

      const changed = await manager.isChanged(projectId, annotation.file, 'hash123');
      expect(changed).toBe(false);
    });

    it('should return true when sourceHash differs', async () => {
      const annotation = createTestAnnotationFile({
        sourceHash: 'hash123',
      });
      await manager.save(projectId, annotation.file, annotation);

      const changed = await manager.isChanged(projectId, annotation.file, 'hash456');
      expect(changed).toBe(true);
    });

    it('should return true when annotation file does not exist', async () => {
      const changed = await manager.isChanged(projectId, 'non/existent.ts', 'hash123');
      expect(changed).toBe(true);
    });
  });

  // ==========================================================
  // merge - userModified 보존 병합
  // ==========================================================

  describe('merge()', () => {
    it('should preserve userModified annotations from existing', async () => {
      const existing = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            function: 'calculateShipping',
            enriched_comment: '사용자가 수정한 주석',
            userModified: true,
            lastModifiedBy: 'user@example.com',
          }),
        ],
      });

      const updated = createTestAnnotationFile({
        sourceHash: 'newhash',
        annotations: [
          createTestAnnotation({
            function: 'calculateShipping',
            enriched_comment: '자동 생성된 새 주석',
            userModified: false,
          }),
        ],
      });

      const merged = await manager.merge(existing, updated);

      expect(merged.annotations).toHaveLength(1);
      expect(merged.annotations[0].enriched_comment).toBe('사용자가 수정한 주석');
      expect(merged.annotations[0].userModified).toBe(true);
      expect(merged.annotations[0].lastModifiedBy).toBe('user@example.com');
    });

    it('should add new functions from updated', async () => {
      const existing = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            function: 'calculateShipping',
            userModified: true,
          }),
        ],
      });

      const updated = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            function: 'calculateShipping',
            enriched_comment: '새로 생성된 주석',
            userModified: false,
          }),
          createTestAnnotation({
            function: 'getDeliveryDate',
            enriched_comment: '새 함수 주석',
            userModified: false,
          }),
        ],
      });

      const merged = await manager.merge(existing, updated);

      expect(merged.annotations).toHaveLength(2);
      // calculateShipping은 userModified이므로 기존 것 보존
      expect(merged.annotations[0].userModified).toBe(true);
      // getDeliveryDate는 새 함수이므로 updated에서 추가
      expect(merged.annotations[1].function).toBe('getDeliveryDate');
      expect(merged.annotations[1].enriched_comment).toBe('새 함수 주석');
    });

    it('should remove functions not present in updated', async () => {
      const existing = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            function: 'calculateShipping',
            userModified: false,
          }),
          createTestAnnotation({
            function: 'oldFunction',
            userModified: false,
          }),
        ],
      });

      const updated = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({
            function: 'calculateShipping',
          }),
        ],
      });

      const merged = await manager.merge(existing, updated);

      expect(merged.annotations).toHaveLength(1);
      expect(merged.annotations[0].function).toBe('calculateShipping');
    });

    it('should use updated metadata (sourceHash, lastAnalyzed, etc.)', async () => {
      const existing = createTestAnnotationFile({
        sourceHash: 'oldhash',
        lastAnalyzed: '2026-01-01T00:00:00Z',
      });

      const updated = createTestAnnotationFile({
        sourceHash: 'newhash',
        lastAnalyzed: '2026-02-17T10:00:00Z',
      });

      const merged = await manager.merge(existing, updated);

      expect(merged.sourceHash).toBe('newhash');
      expect(merged.lastAnalyzed).toBe('2026-02-17T10:00:00Z');
    });
  });

  // ==========================================================
  // cleanup - 삭제된 함수 정리
  // ==========================================================

  describe('cleanup()', () => {
    it('should remove annotations for non-existent functions', async () => {
      const annotation = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({ function: 'functionA' }),
          createTestAnnotation({ function: 'functionB' }),
          createTestAnnotation({ function: 'functionC' }),
        ],
      });

      await manager.save(projectId, annotation.file, annotation);

      // functionB가 삭제됨
      await manager.cleanup(projectId, annotation.file, ['functionA', 'functionC']);

      const loaded = await manager.load(projectId, annotation.file);
      expect(loaded!.annotations).toHaveLength(2);
      expect(loaded!.annotations.map((a) => a.function)).toEqual(['functionA', 'functionC']);
    });

    it('should not modify file when all functions still exist', async () => {
      const annotation = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({ function: 'functionA' }),
          createTestAnnotation({ function: 'functionB' }),
        ],
      });

      await manager.save(projectId, annotation.file, annotation);

      await manager.cleanup(projectId, annotation.file, ['functionA', 'functionB']);

      const loaded = await manager.load(projectId, annotation.file);
      expect(loaded!.annotations).toHaveLength(2);
    });

    it('should handle cleanup for non-existent annotation file gracefully', async () => {
      // Should not throw
      await expect(
        manager.cleanup(projectId, 'non/existent.ts', ['someFunction'])
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================
  // updateMeta / getMeta
  // ==========================================================

  describe('updateMeta() / getMeta()', () => {
    it('should calculate statistics correctly', async () => {
      const annotation1 = createTestAnnotationFile({
        file: 'src/services/shipping.ts',
        system: 'delivery',
        annotations: [
          createTestAnnotation({
            function: 'calcShipping',
            confidence: 0.8,
            policies: [
              { name: 'p1', description: 'd', confidence: 0.9, category: 'c', inferred_from: 'i' },
            ],
          }),
          createTestAnnotation({
            function: 'freeShipping',
            confidence: 0.3, // low confidence
            userModified: true,
            policies: [],
          }),
        ],
      });

      const annotation2 = createTestAnnotationFile({
        file: 'src/services/payment.ts',
        system: 'payment',
        annotations: [
          createTestAnnotation({
            function: 'processPayment',
            confidence: 0.9,
            policies: [
              { name: 'p2', description: 'd', confidence: 0.8, category: 'c', inferred_from: 'i' },
              { name: 'p3', description: 'd', confidence: 0.7, category: 'c', inferred_from: 'i' },
            ],
          }),
        ],
      });

      await manager.save(projectId, annotation1.file, annotation1);
      await manager.save(projectId, annotation2.file, annotation2);

      const meta = await manager.updateMeta(projectId);

      expect(meta.totalFiles).toBe(2);
      expect(meta.totalAnnotations).toBe(3);
      expect(meta.totalPolicies).toBe(3); // 1 + 0 + 2
      expect(meta.lowConfidenceCount).toBe(1); // confidence < 0.5
      expect(meta.userModifiedCount).toBe(1);
      expect(meta.version).toBe('1.0.0');

      // avgConfidence = (0.8 + 0.3 + 0.9) / 3 = 0.667
      expect(meta.avgConfidence).toBeCloseTo(0.67, 1);

      // systems
      expect(meta.systems['delivery']).toBeDefined();
      expect(meta.systems['delivery'].files).toBe(1);
      expect(meta.systems['delivery'].annotations).toBe(2);
      expect(meta.systems['delivery'].policies).toBe(1);

      expect(meta.systems['payment']).toBeDefined();
      expect(meta.systems['payment'].files).toBe(1);
      expect(meta.systems['payment'].annotations).toBe(1);
      expect(meta.systems['payment'].policies).toBe(2);
    });

    it('should read meta correctly after update', async () => {
      const annotation = createTestAnnotationFile();
      await manager.save(projectId, annotation.file, annotation);
      await manager.updateMeta(projectId);

      const meta = await manager.getMeta(projectId);
      expect(meta).not.toBeNull();
      expect(meta!.totalFiles).toBe(1);
      expect(meta!.totalAnnotations).toBe(1);
    });

    it('should return null for getMeta when no meta file exists', async () => {
      const meta = await manager.getMeta('nonexistent-project');
      expect(meta).toBeNull();
    });

    it('should preserve createdAt on subsequent updates', async () => {
      const annotation = createTestAnnotationFile();
      await manager.save(projectId, annotation.file, annotation);

      const meta1 = await manager.updateMeta(projectId);
      const createdAt = meta1.createdAt;

      // 두 번째 업데이트
      const meta2 = await manager.updateMeta(projectId);
      expect(meta2.createdAt).toBe(createdAt);
    });
  });

  // ==========================================================
  // delete
  // ==========================================================

  describe('delete()', () => {
    it('should delete an existing annotation file', async () => {
      const annotation = createTestAnnotationFile();
      await manager.save(projectId, annotation.file, annotation);

      // 파일이 존재하는지 확인
      const loaded = await manager.load(projectId, annotation.file);
      expect(loaded).not.toBeNull();

      // 삭제
      await manager.delete(projectId, annotation.file);

      // 삭제 후 null
      const loadedAfter = await manager.load(projectId, annotation.file);
      expect(loadedAfter).toBeNull();
    });

    it('should handle deleting non-existent file gracefully', async () => {
      await expect(
        manager.delete(projectId, 'non/existent/file.ts')
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================
  // 경로 변환 (간접 검증)
  // ==========================================================

  describe('path conversion', () => {
    it('should handle nested file paths correctly', async () => {
      const deepFile = 'src/modules/shipping/services/calculator.ts';
      const annotation = createTestAnnotationFile({
        file: deepFile,
      });

      await manager.save(projectId, deepFile, annotation);
      const loaded = await manager.load(projectId, deepFile);

      expect(loaded).not.toBeNull();
      expect(loaded!.file).toBe(deepFile);
    });

    it('should handle file paths with leading slashes', async () => {
      const filePath = '/src/services/shipping.ts';
      const annotation = createTestAnnotationFile({
        file: filePath,
      });

      await manager.save(projectId, filePath, annotation);
      const loaded = await manager.load(projectId, filePath);

      expect(loaded).not.toBeNull();
      expect(loaded!.file).toBe(filePath);
    });
  });
});
