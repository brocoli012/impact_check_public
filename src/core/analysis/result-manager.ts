/**
 * @module core/analysis/result-manager
 * @description 결과 관리자 - 분석 결과 저장/로드/목록 조회
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfidenceEnrichedResult } from '../../types/analysis';
import { ensureDir, readJsonFile, writeJsonFile, getProjectDir } from '../../utils/file';
import { logger } from '../../utils/logger';

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
  ): Promise<string> {
    const resultsDir = this.getResultsDir(projectId);
    ensureDir(resultsDir);

    const resultId = result.analysisId || `analysis-${Date.now()}`;
    const filePath = path.join(resultsDir, `${resultId}.json`);

    writeJsonFile(filePath, result);

    // 인덱스 파일 업데이트
    await this.updateIndex(projectId, {
      id: resultId,
      specTitle: title || result.specTitle,
      analyzedAt: result.analyzedAt,
      totalScore: result.totalScore,
      grade: result.grade,
      affectedScreenCount: result.affectedScreens.length,
      taskCount: result.tasks.length,
    });

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
      summaries[existingIndex] = summary;
    } else {
      summaries.push(summary);
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
