/**
 * @module core/session/session-manager
 * @description 세션 관리자 - 분석 중간 결과 저장 및 세션 재개 지원
 */

import * as path from 'path';
import * as fs from 'fs';
import { ConfidenceEnrichedResult } from '../../types/analysis';
import { ensureDir, readJsonFile, writeJsonFile, getImpactDir } from '../../utils/file';
import { logger } from '../../utils/logger';

/** 세션 상태 */
export interface SessionState {
  /** 세션 ID */
  sessionId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 기획서 경로 */
  specFilePath?: string;
  /** 기획서 내용 (텍스트 입력인 경우) */
  specContent?: string;
  /** 마지막 완료 단계 (1~6) */
  lastCompletedStep: number;
  /** 전체 단계 수 */
  totalSteps: number;
  /** 부분 결과 (있으면) */
  partialResult?: Partial<ConfidenceEnrichedResult>;
  /** 세션 시작 시각 */
  startedAt: string;
  /** 마지막 업데이트 시각 */
  updatedAt: string;
  /** 오류 메시지 (실패 시) */
  errorMessage?: string;
}

/** 재개 정보 */
export interface ResumeInfo {
  /** 세션 상태 */
  session: SessionState;
  /** 재개 가능 여부 */
  canResume: boolean;
  /** 재개 불가 시 이유 */
  reason?: string;
}

/**
 * SessionManager - 분석 세션 관리
 *
 * .impact/session/ 디렉토리에 세션 상태를 저장하고
 * --resume 플래그로 이전 세션을 재개할 수 있습니다.
 */
export class SessionManager {
  private readonly basePath?: string;

  constructor(basePath?: string) {
    this.basePath = basePath;
  }

  /**
   * 세션 디렉토리 경로
   */
  private getSessionDir(): string {
    return path.join(getImpactDir(this.basePath), 'session');
  }

  /**
   * 부분 결과 파일 경로
   */
  private getPartialResultPath(): string {
    return path.join(this.getSessionDir(), 'partial-result.json');
  }

  /**
   * 재개 정보 파일 경로
   */
  private getPendingResumePath(): string {
    return path.join(this.getSessionDir(), 'pending-resume.json');
  }

  /**
   * 새 세션 시작
   * @param projectId - 프로젝트 ID
   * @param specFilePath - 기획서 파일 경로 (선택)
   * @param specContent - 기획서 내용 (선택)
   * @returns 세션 상태
   */
  startSession(
    projectId: string,
    specFilePath?: string,
    specContent?: string,
  ): SessionState {
    const now = new Date().toISOString();
    const sessionId = `session-${Date.now()}`;

    const session: SessionState = {
      sessionId,
      projectId,
      specFilePath,
      specContent,
      lastCompletedStep: 0,
      totalSteps: 6,
      startedAt: now,
      updatedAt: now,
    };

    this.saveSession(session);
    logger.debug(`Session started: ${sessionId}`);
    return session;
  }

  /**
   * 세션 진행 상황 업데이트
   * @param session - 현재 세션 상태
   * @param completedStep - 완료된 단계 번호
   * @param partialResult - 부분 결과 (선택)
   */
  updateProgress(
    session: SessionState,
    completedStep: number,
    partialResult?: Partial<ConfidenceEnrichedResult>,
  ): void {
    session.lastCompletedStep = completedStep;
    session.updatedAt = new Date().toISOString();

    if (partialResult) {
      session.partialResult = partialResult;
      // 부분 결과를 별도 파일로도 저장
      this.savePartialResult(partialResult);
    }

    this.saveSession(session);
    logger.debug(`Session progress: step ${completedStep}/${session.totalSteps}`);
  }

  /**
   * 세션 실패 기록
   * @param session - 세션 상태
   * @param errorMessage - 오류 메시지
   */
  recordFailure(session: SessionState, errorMessage: string): void {
    session.errorMessage = errorMessage;
    session.updatedAt = new Date().toISOString();
    this.saveSession(session);
    logger.debug(`Session failure recorded: ${errorMessage}`);
  }

  /**
   * 세션 완료 처리 (세션 파일 삭제)
   */
  completeSession(): void {
    const resumePath = this.getPendingResumePath();
    const partialPath = this.getPartialResultPath();

    if (fs.existsSync(resumePath)) {
      fs.unlinkSync(resumePath);
    }
    if (fs.existsSync(partialPath)) {
      fs.unlinkSync(partialPath);
    }

    logger.debug('Session completed and cleaned up');
  }

  /**
   * 재개 가능한 세션이 있는지 확인
   * @returns 재개 정보
   */
  checkPendingResume(): ResumeInfo | null {
    const resumePath = this.getPendingResumePath();

    if (!fs.existsSync(resumePath)) {
      return null;
    }

    const session = readJsonFile<SessionState>(resumePath);
    if (!session) {
      return null;
    }

    // 세션 유효성 검사: 24시간 이상 경과 시 만료
    const sessionAge = Date.now() - new Date(session.updatedAt).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      return {
        session,
        canResume: false,
        reason: '세션이 24시간 이상 경과하여 만료되었습니다.',
      };
    }

    // 부분 결과 확인
    if (session.lastCompletedStep === 0) {
      return {
        session,
        canResume: false,
        reason: '진행된 분석이 없습니다. 새로 분석을 시작하세요.',
      };
    }

    return {
      session,
      canResume: true,
    };
  }

  /**
   * 부분 결과 로드
   * @returns 부분 결과 또는 null
   */
  loadPartialResult(): Partial<ConfidenceEnrichedResult> | null {
    const partialPath = this.getPartialResultPath();
    if (!fs.existsSync(partialPath)) {
      return null;
    }
    return readJsonFile<Partial<ConfidenceEnrichedResult>>(partialPath);
  }

  /**
   * 세션 상태 저장
   */
  private saveSession(session: SessionState): void {
    const sessionDir = this.getSessionDir();
    ensureDir(sessionDir);
    writeJsonFile(this.getPendingResumePath(), session);
  }

  /**
   * 부분 결과 저장
   */
  private savePartialResult(result: Partial<ConfidenceEnrichedResult>): void {
    const sessionDir = this.getSessionDir();
    ensureDir(sessionDir);
    writeJsonFile(this.getPartialResultPath(), result);
  }
}
