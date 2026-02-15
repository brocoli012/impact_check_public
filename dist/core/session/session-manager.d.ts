/**
 * @module core/session/session-manager
 * @description 세션 관리자 - 분석 중간 결과 저장 및 세션 재개 지원
 */
import { ConfidenceEnrichedResult } from '../../types/analysis';
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
export declare class SessionManager {
    private readonly basePath?;
    constructor(basePath?: string);
    /**
     * 세션 디렉토리 경로
     */
    private getSessionDir;
    /**
     * 부분 결과 파일 경로
     */
    private getPartialResultPath;
    /**
     * 재개 정보 파일 경로
     */
    private getPendingResumePath;
    /**
     * 새 세션 시작
     * @param projectId - 프로젝트 ID
     * @param specFilePath - 기획서 파일 경로 (선택)
     * @param specContent - 기획서 내용 (선택)
     * @returns 세션 상태
     */
    startSession(projectId: string, specFilePath?: string, specContent?: string): SessionState;
    /**
     * 세션 진행 상황 업데이트
     * @param session - 현재 세션 상태
     * @param completedStep - 완료된 단계 번호
     * @param partialResult - 부분 결과 (선택)
     */
    updateProgress(session: SessionState, completedStep: number, partialResult?: Partial<ConfidenceEnrichedResult>): void;
    /**
     * 세션 실패 기록
     * @param session - 세션 상태
     * @param errorMessage - 오류 메시지
     */
    recordFailure(session: SessionState, errorMessage: string): void;
    /**
     * 세션 완료 처리 (세션 파일 삭제)
     */
    completeSession(): void;
    /**
     * 재개 가능한 세션이 있는지 확인
     * @returns 재개 정보
     */
    checkPendingResume(): ResumeInfo | null;
    /**
     * 부분 결과 로드
     * @returns 부분 결과 또는 null
     */
    loadPartialResult(): Partial<ConfidenceEnrichedResult> | null;
    /**
     * 세션 상태 저장
     */
    private saveSession;
    /**
     * 부분 결과 저장
     */
    private savePartialResult;
}
//# sourceMappingURL=session-manager.d.ts.map