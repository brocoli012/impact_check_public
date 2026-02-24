/**
 * @module core/analysis/result-manager
 * @description 결과 관리자 - 분석 결과 저장/로드/목록 조회
 */
import { ConfidenceEnrichedResult } from '../../types/analysis';
import { AnalysisStatus } from '../../utils/analysis-status';
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
export declare class ResultManager {
    private readonly basePath?;
    constructor(basePath?: string);
    /**
     * 결과 저장
     * @param result - 분석 결과
     * @param projectId - 프로젝트 ID
     * @param title - 결과 제목 (선택)
     * @returns 결과 ID
     */
    save(result: ConfidenceEnrichedResult, projectId: string, title?: string, defaultStatus?: AnalysisStatus): Promise<string>;
    /**
     * 최신 결과 로드
     * @param projectId - 프로젝트 ID
     * @returns 최신 결과 또는 null
     */
    getLatest(projectId: string): Promise<ConfidenceEnrichedResult | null>;
    /**
     * ID로 결과 로드
     * @param projectId - 프로젝트 ID
     * @param resultId - 결과 ID
     * @returns 분석 결과 또는 null
     */
    getById(projectId: string, resultId: string): Promise<ConfidenceEnrichedResult | null>;
    /**
     * 결과 목록 조회
     * @param projectId - 프로젝트 ID
     * @returns 결과 요약 목록
     */
    list(projectId: string): Promise<ResultSummary[]>;
    /**
     * 크로스 프로젝트 탐지 결과를 특정 분석 결과 요약에 기록
     * @param projectId - 프로젝트 ID
     * @param resultId - 결과 ID
     * @param detection - 크로스 프로젝트 탐지 정보
     */
    updateCrossProjectDetection(projectId: string, resultId: string, detection: CrossProjectDetectionInfo): Promise<void>;
    /**
     * 유효 상태 조회 (Lazy Migration 지원)
     * status 필드가 없는 기존 데이터는 'active'로 간주
     */
    getEffectiveStatus(summary: ResultSummary): AnalysisStatus;
    /**
     * 분석 결과 상태 변경
     * @param projectId - 프로젝트 ID
     * @param analysisId - 분석 결과 ID
     * @param newStatus - 새 상태
     * @returns 업데이트된 ResultSummary
     * @throws 유효하지 않은 전환 또는 결과 미존재 시 Error
     */
    updateStatus(projectId: string, analysisId: string, newStatus: AnalysisStatus): Promise<ResultSummary>;
    /**
     * active 상태의 최신 분석 반환
     * [R4-07] archived 제외 - archived만 남은 프로젝트 대응
     */
    getLatestActive(projectId: string): Promise<ResultSummary | null>;
    /**
     * 상태별 분석 결과 목록 조회
     * @param projectId - 프로젝트 ID
     * @param status - 필터할 상태 (미지정 시 전체 반환)
     */
    listByStatus(projectId: string, status?: AnalysisStatus): Promise<ResultSummary[]>;
    /**
     * analysisId로 프로젝트 ID 역매핑
     * 모든 프로젝트의 인덱스를 순회하여 검색
     */
    findByAnalysisId(analysisId: string): Promise<{
        projectId: string;
        summary: ResultSummary;
    } | null>;
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
    saveSupplementResult(projectId: string, originalAnalysisId: string, result: ConfidenceEnrichedResult): Promise<string>;
    /**
     * 특정 분석의 보완 분석 결과 조회
     *
     * @param projectId - 프로젝트 ID
     * @param originalAnalysisId - 원본 분석 ID
     * @returns 보완 분석 결과 목록
     */
    getSupplementResults(projectId: string, originalAnalysisId: string): Promise<ConfidenceEnrichedResult[]>;
    /**
     * 보완 분석 결과인지 확인
     *
     * @param resultId - 결과 ID
     * @returns 보완 분석 결과 여부
     */
    isSupplementResult(resultId: string): boolean;
    /**
     * 인덱스 파일 업데이트
     */
    private updateIndex;
    /**
     * 결과 디렉토리 경로
     */
    private getResultsDir;
    /**
     * 인덱스 파일 경로
     */
    private getIndexPath;
}
//# sourceMappingURL=result-manager.d.ts.map