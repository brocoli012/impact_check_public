/**
 * @module core/analysis/result-manager
 * @description 결과 관리자 - 분석 결과 저장/로드/목록 조회
 */
import { ConfidenceEnrichedResult } from '../../types/analysis';
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
    save(result: ConfidenceEnrichedResult, projectId: string, title?: string): Promise<string>;
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