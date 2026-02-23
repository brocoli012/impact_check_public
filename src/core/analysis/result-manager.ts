/**
 * @module core/analysis/result-manager
 * @description 결과 관리자 - 분석 결과 저장/로드/목록 조회
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfidenceEnrichedResult } from '../../types/analysis';
import { AnalysisStatus, getEffectiveStatus, isValidTransition, getTransitionError } from '../../utils/analysis-status';
import { ensureDir, readJsonFile, writeJsonFile, getProjectDir } from '../../utils/file';
import { logger } from '../../utils/logger';
import type { ProjectsConfig } from '../../types/index';

/** 크로스 프로젝트 탐지 결과 정보 */
export interface CrossProjectDetectionInfo {
  /** 탐지 시각 */
  detectedAt: string;
  /** 감지된 링크 수 */
  linksDetected: number;
  /** 신규 저장된 링크 수 */
  linksNew: number;
  /** 전체 링크 수 */
  linksTotal: number;
}

/** 결과 요약 정보 */
export interface ResultSummary {
  /** 결과 ID */
  id: string;
  /** 기획서 제목 */
  specTitle: string;
  /** 분석 시각 */
  analyzedAt: string;
  /** 총점 */
  totalScore: number;
  /** 등급 */
  grade: string;
  /** 영향 화면 수 */
  affectedScreenCount: number;
  /** 작업 수 */
  taskCount: number;
  /** 크로스 프로젝트 탐지 결과 (optional) */
  crossProjectDetection?: CrossProjectDetectionInfo;
  /** 분석 상태 (없으면 'active'로 간주) */
  status?: AnalysisStatus;
  /** 상태 변경 시각 */
  statusChangedAt?: string;
  /** 보완 분석 여부 */
  isSupplement?: boolean;
  /** 보완 분석 원본 분석 ID */
  supplementOf?: string;
  /** 보완 분석 트리거 프로젝트 */
  triggerProject?: string;
}

/**
 * ResultManager - 분석 결과 관리
 *
 * .impact/projects/{projectId}/results/ 디렉토리에
 * 분석 결과를 JSON으로 저장하고 로드.
 *
 * Design note: Methods are async for future migration to async I/O
 * (fs.promises). Currently uses synchronous I/O (fs.existsSync,
 * readJsonFile/writeJsonFile which wrap fs.readFileSync/writeFileSync)
 * for simplicity. The async signatures allow callers to be written
 * against the future-proof contract without a breaking change later.
 */
export class ResultManager {
  private readonly basePath?: string;

  constructor(basePath?: string) {
    this.basePath = basePath;
  }

  /**
   * 결과 저장
   * @param result - 분석 결과
   * @param projectId - 프로젝트 ID
   * @param title - 결과 제목 (선택)
   * @returns 결과 ID
   */
  async save(
    result: ConfidenceEnrichedResult,
    projectId: string,
    title?: string,
    defaultStatus?: AnalysisStatus,
  ): Promise<string> {
    const resultsDir = this.getResultsDir(projectId);
    ensureDir(resultsDir);

    const resultId = result.analysisId || `analysis-${Date.now()}`;
    const filePath = path.join(resultsDir, `${resultId}.json`);

    writeJsonFile(filePath, result);

    // 인덱스 파일 업데이트
    // defaultStatus가 명시적으로 전달된 경우에만 status를 설정하고,
    // 그렇지 않으면 undefined로 두어 updateIndex에서 기존 값을 보존하도록 함
    const summaryForIndex: ResultSummary = {
      id: resultId,
      specTitle: title || result.specTitle,
      analyzedAt: result.analyzedAt,
      totalScore: result.totalScore,
      grade: result.grade,
      affectedScreenCount: result.affectedScreens.length,
      taskCount: result.tasks.length,
    };
    // 명시적 defaultStatus가 있으면 설정, 없으면 신규 항목에서만 'active' 적용
    if (defaultStatus !== undefined) {
      summaryForIndex.status = defaultStatus;
    }
    await this.updateIndex(projectId, summaryForIndex);

    logger.info(`Result saved: ${filePath}`);
    return resultId;
  }

  /**
   * 최신 결과 로드
   * @param projectId - 프로젝트 ID
   * @returns 최신 결과 또는 null
   */
  async getLatest(projectId: string): Promise<ConfidenceEnrichedResult | null> {
    const summaries = await this.list(projectId);
    if (summaries.length === 0) return null;

    // 최신순 정렬
    summaries.sort((a, b) =>
      new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
    );

    return this.getById(projectId, summaries[0].id);
  }

  /**
   * ID로 결과 로드
   * @param projectId - 프로젝트 ID
   * @param resultId - 결과 ID
   * @returns 분석 결과 또는 null
   */
  async getById(
    projectId: string,
    resultId: string,
  ): Promise<ConfidenceEnrichedResult | null> {
    const filePath = path.join(this.getResultsDir(projectId), `${resultId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      return readJsonFile<ConfidenceEnrichedResult>(filePath);
    } catch (err) {
      logger.error(`Failed to load result ${resultId}:`, err);
      return null;
    }
  }

  /**
   * 결과 목록 조회
   * @param projectId - 프로젝트 ID
   * @returns 결과 요약 목록
   */
  async list(projectId: string): Promise<ResultSummary[]> {
    const indexPath = this.getIndexPath(projectId);

    if (!fs.existsSync(indexPath)) {
      return [];
    }

    try {
      const summaries = readJsonFile<ResultSummary[]>(indexPath);
      return summaries || [];
    } catch {
      return [];
    }
  }

  /**
   * 크로스 프로젝트 탐지 결과를 특정 분석 결과 요약에 기록
   * @param projectId - 프로젝트 ID
   * @param resultId - 결과 ID
   * @param detection - 크로스 프로젝트 탐지 정보
   */
  async updateCrossProjectDetection(
    projectId: string,
    resultId: string,
    detection: CrossProjectDetectionInfo,
  ): Promise<void> {
    const indexPath = this.getIndexPath(projectId);
    if (!fs.existsSync(indexPath)) return;

    const summaries = readJsonFile<ResultSummary[]>(indexPath) || [];
    const idx = summaries.findIndex(s => s.id === resultId);
    if (idx >= 0) {
      summaries[idx] = { ...summaries[idx], crossProjectDetection: detection };
      writeJsonFile(indexPath, summaries);
    }
  }

  /**
   * 유효 상태 조회 (Lazy Migration 지원)
   * status 필드가 없는 기존 데이터는 'active'로 간주
   */
  getEffectiveStatus(summary: ResultSummary): AnalysisStatus {
    return getEffectiveStatus(summary.status);
  }

  /**
   * 분석 결과 상태 변경
   * @param projectId - 프로젝트 ID
   * @param analysisId - 분석 결과 ID
   * @param newStatus - 새 상태
   * @returns 업데이트된 ResultSummary
   * @throws 유효하지 않은 전환 또는 결과 미존재 시 Error
   */
  async updateStatus(
    projectId: string,
    analysisId: string,
    newStatus: AnalysisStatus,
  ): Promise<ResultSummary> {
    const indexPath = this.getIndexPath(projectId);
    const summaries = readJsonFile<ResultSummary[]>(indexPath) || [];

    const idx = summaries.findIndex(s => s.id === analysisId);
    if (idx < 0) {
      throw new Error(`분석 결과를 찾을 수 없습니다: ${analysisId}`);
    }

    const current = summaries[idx];
    const currentStatus = getEffectiveStatus(current.status);

    if (!isValidTransition(currentStatus, newStatus)) {
      throw new Error(getTransitionError(currentStatus, newStatus));
    }

    summaries[idx] = {
      ...current,
      status: newStatus,
      statusChangedAt: new Date().toISOString(),
    };

    writeJsonFile(indexPath, summaries);
    return summaries[idx];
  }

  /**
   * active 상태의 최신 분석 반환
   * [R4-07] archived 제외 - archived만 남은 프로젝트 대응
   */
  async getLatestActive(projectId: string): Promise<ResultSummary | null> {
    const summaries = await this.list(projectId);
    const activeSummaries = summaries.filter(
      s => getEffectiveStatus(s.status) === 'active',
    );
    if (activeSummaries.length === 0) return null;
    return activeSummaries.sort(
      (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime(),
    )[0];
  }

  /**
   * 상태별 분석 결과 목록 조회
   * @param projectId - 프로젝트 ID
   * @param status - 필터할 상태 (미지정 시 전체 반환)
   */
  async listByStatus(projectId: string, status?: AnalysisStatus): Promise<ResultSummary[]> {
    const summaries = await this.list(projectId);
    if (!status) return summaries;
    return summaries.filter(s => getEffectiveStatus(s.status) === status);
  }

  /**
   * analysisId로 프로젝트 ID 역매핑
   * 모든 프로젝트의 인덱스를 순회하여 검색
   */
  async findByAnalysisId(
    analysisId: string,
  ): Promise<{ projectId: string; summary: ResultSummary } | null> {
    const projectsPath = path.join(
      this.basePath || process.env.HOME || '',
      '.impact',
      'projects.json',
    );
    const config = readJsonFile<ProjectsConfig>(projectsPath);
    if (!config?.projects) return null;

    for (const project of config.projects) {
      const summaries = await this.list(project.id);
      const found = summaries.find(s => s.id === analysisId);
      if (found) {
        return { projectId: project.id, summary: found };
      }
    }

    return null;
  }

  /**
   * 보완 분석 결과 저장
   *
   * supplement-{originalAnalysisId}.json 형식으로 저장하고,
   * 인덱스에 isSupplement, supplementOf, triggerProject를 기록한다.
   *
   * @param projectId - 프로젝트 ID (보완 분석 대상 프로젝트)
   * @param originalAnalysisId - 원본 분석 ID
   * @param result - 보완 분석 결과
   * @returns 저장된 파일 경로
   */
  async saveSupplementResult(
    projectId: string,
    originalAnalysisId: string,
    result: ConfidenceEnrichedResult,
  ): Promise<string> {
    const resultsDir = this.getResultsDir(projectId);
    ensureDir(resultsDir);

    const supplementId = `supplement-${originalAnalysisId}`;
    const filePath = path.join(resultsDir, `${supplementId}.json`);

    // 보완 분석 메타데이터 설정
    const supplementResult: ConfidenceEnrichedResult = {
      ...result,
      supplementOf: originalAnalysisId,
      triggerProject: result.triggerProject,
    };

    writeJsonFile(filePath, supplementResult);

    // 인덱스에 보완 분석 정보 기록
    const summaryForIndex: ResultSummary = {
      id: supplementId,
      specTitle: result.specTitle,
      analyzedAt: result.analyzedAt,
      totalScore: result.totalScore,
      grade: result.grade,
      affectedScreenCount: result.affectedScreens.length,
      taskCount: result.tasks.length,
      status: 'active',
      isSupplement: true,
      supplementOf: originalAnalysisId,
      triggerProject: result.triggerProject,
    };
    await this.updateIndex(projectId, summaryForIndex);

    logger.info(`Supplement result saved: ${filePath}`);
    return filePath;
  }

  /**
   * 특정 분석의 보완 분석 결과 조회
   *
   * @param projectId - 프로젝트 ID
   * @param originalAnalysisId - 원본 분석 ID
   * @returns 보완 분석 결과 목록
   */
  async getSupplementResults(
    projectId: string,
    originalAnalysisId: string,
  ): Promise<ConfidenceEnrichedResult[]> {
    const resultsDir = this.getResultsDir(projectId);
    const supplementId = `supplement-${originalAnalysisId}`;
    const filePath = path.join(resultsDir, `${supplementId}.json`);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const result = readJsonFile<ConfidenceEnrichedResult>(filePath);
      return result ? [result] : [];
    } catch (err) {
      logger.error(`Failed to load supplement result for ${originalAnalysisId}:`, err);
      return [];
    }
  }

  /**
   * 보완 분석 결과인지 확인
   *
   * @param resultId - 결과 ID
   * @returns 보완 분석 결과 여부
   */
  isSupplementResult(resultId: string): boolean {
    return resultId.startsWith('supplement-');
  }

  /**
   * 인덱스 파일 업데이트
   */
  private async updateIndex(
    projectId: string,
    summary: ResultSummary,
  ): Promise<void> {
    const indexPath = this.getIndexPath(projectId);
    let summaries: ResultSummary[] = [];

    if (fs.existsSync(indexPath)) {
      summaries = readJsonFile<ResultSummary[]>(indexPath) || [];
    }

    // 기존 항목이 있으면 업데이트, 없으면 추가
    const existingIndex = summaries.findIndex(s => s.id === summary.id);
    if (existingIndex >= 0) {
      // 기존 필드 보존 (새 summary에 없으면 기존 값 유지)
      const existing = summaries[existingIndex];
      summaries[existingIndex] = {
        ...summary,
        crossProjectDetection: summary.crossProjectDetection ?? existing.crossProjectDetection,
        status: summary.status ?? existing.status,
        statusChangedAt: summary.statusChangedAt ?? existing.statusChangedAt,
        isSupplement: summary.isSupplement ?? existing.isSupplement,
        supplementOf: summary.supplementOf ?? existing.supplementOf,
        triggerProject: summary.triggerProject ?? existing.triggerProject,
      };
    } else {
      // 신규 항목: status가 없으면 'active'로 기본 설정
      summaries.push({
        ...summary,
        status: summary.status ?? 'active',
      });
    }

    writeJsonFile(indexPath, summaries);
  }

  /**
   * 결과 디렉토리 경로
   */
  private getResultsDir(projectId: string): string {
    return path.join(getProjectDir(projectId, this.basePath), 'results');
  }

  /**
   * 인덱스 파일 경로
   */
  private getIndexPath(projectId: string): string {
    return path.join(this.getResultsDir(projectId), 'index.json');
  }
}
