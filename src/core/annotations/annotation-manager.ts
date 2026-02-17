/**
 * @module core/annotations/annotation-manager
 * @description AnnotationManager - YAML 기반 보강 주석 CRUD, sourceHash 비교, userModified 병합
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AnnotationFile, AnnotationMeta, FunctionAnnotation } from '../../types/annotations';
import { logger } from '../../utils/logger';

/** 기본 보강 주석 저장 경로 */
const DEFAULT_BASE_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.impact'
);

/** 보강 주석 파일 확장자 */
const ANNOTATION_EXTENSION = '.annotations.yaml';

/** meta.json 파일명 */
const META_FILENAME = 'meta.json';

/**
 * AnnotationManager - 보강 주석 파일의 CRUD 및 병합을 담당
 *
 * 기능:
 *   - YAML 파일로 보강 주석 저장/로드
 *   - sourceHash 비교를 통한 변경 감지
 *   - userModified 항목 보존 병합
 *   - 삭제된 함수의 보강 주석 정리
 *   - meta.json 통계 관리
 */
export class AnnotationManager {
  private readonly basePath: string;

  /**
   * @param basePath - 보강 주석 기본 저장 경로 (기본값: ~/.impact)
   */
  constructor(basePath?: string) {
    this.basePath = basePath || DEFAULT_BASE_PATH;
  }

  /**
   * 보강 주석 파일을 YAML로 저장
   * @param projectId - 프로젝트 ID
   * @param filePath - 원본 파일 경로
   * @param annotation - 보강 주석 데이터
   */
  async save(projectId: string, filePath: string, annotation: AnnotationFile): Promise<void> {
    const annotationPath = this.getAnnotationPath(projectId, filePath);
    const dir = path.dirname(annotationPath);

    await this.ensureDir(dir);

    const yamlContent = yaml.dump(annotation, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    fs.writeFileSync(annotationPath, yamlContent, 'utf-8');
    logger.debug(`Annotation saved: ${annotationPath}`);
  }

  /**
   * 보강 주석 파일을 YAML에서 로드
   * @param projectId - 프로젝트 ID
   * @param filePath - 원본 파일 경로
   * @returns 보강 주석 데이터 또는 null (파일 없을 시)
   */
  async load(projectId: string, filePath: string): Promise<AnnotationFile | null> {
    const annotationPath = this.getAnnotationPath(projectId, filePath);

    if (!fs.existsSync(annotationPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(annotationPath, 'utf-8');
      const parsed = yaml.load(content) as AnnotationFile;
      return parsed;
    } catch (err) {
      logger.warn(`Failed to load annotation: ${annotationPath}`, err);
      return null;
    }
  }

  /**
   * 특정 프로젝트의 모든 보강 주석을 로드
   * @param projectId - 프로젝트 ID
   * @returns 파일경로 -> AnnotationFile 맵
   */
  async loadAll(projectId: string): Promise<Map<string, AnnotationFile>> {
    const result = new Map<string, AnnotationFile>();
    const projectDir = path.join(this.basePath, 'annotations', projectId);

    if (!fs.existsSync(projectDir)) {
      return result;
    }

    const yamlFiles = this.findYamlFiles(projectDir);

    for (const yamlFile of yamlFiles) {
      try {
        const content = fs.readFileSync(yamlFile, 'utf-8');
        const parsed = yaml.load(content) as AnnotationFile;
        if (parsed && parsed.file) {
          result.set(parsed.file, parsed);
        }
      } catch (err) {
        logger.warn(`Failed to load annotation file: ${yamlFile}`, err);
      }
    }

    return result;
  }

  /**
   * sourceHash 비교 - 원본 파일 변경 여부 확인
   * @param projectId - 프로젝트 ID
   * @param filePath - 원본 파일 경로
   * @param currentHash - 현재 파일의 SHA-256 해시
   * @returns 변경되었으면 true, 동일하면 false
   */
  async isChanged(projectId: string, filePath: string, currentHash: string): Promise<boolean> {
    const existing = await this.load(projectId, filePath);

    if (!existing) {
      return true; // 파일이 없으면 변경된 것으로 간주
    }

    return existing.sourceHash !== currentHash;
  }

  /**
   * userModified 보존 병합
   *
   * 병합 규칙:
   *   - updated의 annotations을 기본으로 사용
   *   - existing의 annotations 중 userModified: true인 항목은 보존
   *   - 동일 함수명의 userModified 항목은 existing 것을 유지
   *   - 새로운 함수는 updated에서 추가
   *
   * @param existing - 기존 보강 주석
   * @param updated - 새로 생성된 보강 주석
   * @returns 병합된 보강 주석
   */
  async merge(existing: AnnotationFile, updated: AnnotationFile): Promise<AnnotationFile> {
    // existing에서 userModified인 항목을 맵으로 구성
    const userModifiedMap = new Map<string, FunctionAnnotation>();
    for (const ann of existing.annotations) {
      if (ann.userModified) {
        userModifiedMap.set(ann.function, ann);
      }
    }

    // updated의 annotations을 기본으로, userModified 항목은 existing 것으로 대체
    const mergedAnnotations: FunctionAnnotation[] = updated.annotations.map((updatedAnn) => {
      const existingUserModified = userModifiedMap.get(updatedAnn.function);
      if (existingUserModified) {
        // userModified 항목은 기존 것 보존
        return existingUserModified;
      }
      return updatedAnn;
    });

    // existing에만 있는 userModified 항목 중, updated에 없는 함수는 제거됨 (의도적)
    // updated에 존재하는 함수만 결과에 포함

    return {
      ...updated,
      annotations: mergedAnnotations,
    };
  }

  /**
   * 삭제된 함수의 보강 주석 정리
   * @param projectId - 프로젝트 ID
   * @param filePath - 원본 파일 경로
   * @param currentFunctions - 현재 존재하는 함수명 목록
   */
  async cleanup(projectId: string, filePath: string, currentFunctions: string[]): Promise<void> {
    const existing = await this.load(projectId, filePath);
    if (!existing) {
      return;
    }

    const currentSet = new Set(currentFunctions);
    const cleanedAnnotations = existing.annotations.filter(
      (ann) => currentSet.has(ann.function)
    );

    if (cleanedAnnotations.length !== existing.annotations.length) {
      const removed = existing.annotations.length - cleanedAnnotations.length;
      logger.info(`Cleaned up ${removed} annotations for removed functions in ${filePath}`);

      const updatedFile: AnnotationFile = {
        ...existing,
        annotations: cleanedAnnotations,
      };

      await this.save(projectId, filePath, updatedFile);
    }
  }

  /**
   * meta.json 통계 갱신
   * @param projectId - 프로젝트 ID
   * @returns 갱신된 메타 정보
   */
  async updateMeta(projectId: string): Promise<AnnotationMeta> {
    const allAnnotations = await this.loadAll(projectId);

    let totalAnnotations = 0;
    let totalPolicies = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;
    let lowConfidenceCount = 0;
    let userModifiedCount = 0;
    const systems: Record<string, { files: number; annotations: number; policies: number }> = {};

    for (const [, annotationFile] of allAnnotations) {
      const system = annotationFile.system || 'unknown';
      if (!systems[system]) {
        systems[system] = { files: 0, annotations: 0, policies: 0 };
      }
      systems[system].files += 1;

      for (const ann of annotationFile.annotations) {
        totalAnnotations += 1;
        systems[system].annotations += 1;

        const policyCount = ann.policies ? ann.policies.length : 0;
        totalPolicies += policyCount;
        systems[system].policies += policyCount;

        totalConfidence += ann.confidence;
        confidenceCount += 1;

        if (ann.confidence < 0.5) {
          lowConfidenceCount += 1;
        }

        if (ann.userModified) {
          userModifiedCount += 1;
        }
      }
    }

    const now = new Date().toISOString();
    const existingMeta = await this.getMeta(projectId);

    const meta: AnnotationMeta = {
      version: '1.0.0',
      createdAt: existingMeta?.createdAt || now,
      lastUpdatedAt: now,
      totalFiles: allAnnotations.size,
      totalAnnotations,
      totalPolicies,
      systems,
      avgConfidence: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0,
      lowConfidenceCount,
      userModifiedCount,
    };

    const metaPath = this.getMetaPath(projectId);
    const metaDir = path.dirname(metaPath);
    await this.ensureDir(metaDir);

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    logger.debug(`Meta updated: ${metaPath}`);

    return meta;
  }

  /**
   * meta.json 읽기
   * @param projectId - 프로젝트 ID
   * @returns 메타 정보 또는 null
   */
  async getMeta(projectId: string): Promise<AnnotationMeta | null> {
    const metaPath = this.getMetaPath(projectId);

    if (!fs.existsSync(metaPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(content) as AnnotationMeta;
    } catch (err) {
      logger.warn(`Failed to read meta.json: ${metaPath}`, err);
      return null;
    }
  }

  /**
   * 보강 주석 파일 삭제
   * @param projectId - 프로젝트 ID
   * @param filePath - 원본 파일 경로
   */
  async delete(projectId: string, filePath: string): Promise<void> {
    const annotationPath = this.getAnnotationPath(projectId, filePath);

    if (fs.existsSync(annotationPath)) {
      fs.unlinkSync(annotationPath);
      logger.debug(`Annotation deleted: ${annotationPath}`);
    }
  }

  /**
   * 디렉토리 존재 확인/생성
   * @param dirPath - 디렉토리 경로
   */
  private async ensureDir(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 파일 경로를 보강 주석 파일 경로로 변환
   *
   * 규칙: {basePath}/annotations/{projectId}/{원본파일경로}.annotations.yaml
   * 예: ~/.impact/annotations/my-project/src/services/shipping.ts.annotations.yaml
   *
   * @param projectId - 프로젝트 ID
   * @param filePath - 원본 파일 경로
   * @returns 보강 주석 파일 절대 경로
   */
  private getAnnotationPath(projectId: string, filePath: string): string {
    // 선행 슬래시 제거 (절대경로에서 상대경로로 변환)
    const normalizedPath = filePath.replace(/^\/+/, '');
    return path.join(
      this.basePath,
      'annotations',
      projectId,
      `${normalizedPath}${ANNOTATION_EXTENSION}`
    );
  }

  /**
   * meta.json 파일 경로 반환
   * @param projectId - 프로젝트 ID
   * @returns meta.json 절대 경로
   */
  private getMetaPath(projectId: string): string {
    return path.join(this.basePath, 'annotations', projectId, META_FILENAME);
  }

  /**
   * 디렉토리 내의 모든 .annotations.yaml 파일을 재귀적으로 찾기
   * @param dir - 탐색할 디렉토리
   * @returns YAML 파일 경로 목록
   */
  private findYamlFiles(dir: string): string[] {
    const results: string[] = [];

    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.findYamlFiles(fullPath));
      } else if (entry.name.endsWith(ANNOTATION_EXTENSION)) {
        results.push(fullPath);
      }
    }

    return results;
  }
}
