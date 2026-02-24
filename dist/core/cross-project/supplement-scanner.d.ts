/**
 * @module core/cross-project/supplement-scanner
 * @description 보완 분석 후보 스캐너 - 신규 프로젝트 등록 시 기존 분석 결과 매칭
 *
 * 신규 프로젝트 등록 시, 기존 active 상태 분석 결과를 스캔하여
 * 매칭도 20% 이상인 항목을 보완 분석 후보로 제안한다.
 */
/** 보완 분석 후보 */
export interface SupplementCandidate {
    /** 분석 ID */
    analysisId: string;
    /** 기존 분석의 프로젝트 ID */
    projectId: string;
    /** 결과 ID */
    resultId: string;
    /** 분석 결과 제목 */
    title: string;
    /** 매칭도 (0~100) */
    matchRate: number;
    /** 매칭된 키워드 */
    matchedKeywords: string[];
    /** 추천 유형 */
    recommendation: 'auto' | 'suggest' | 'excluded';
    /** 분석 결과 상태 */
    status: string;
}
/** 보완 분석 스캔 결과 */
export interface SupplementScanResult {
    /** 신규 프로젝트 ID */
    newProjectId: string;
    /** 보완 분석 후보 목록 */
    candidates: SupplementCandidate[];
    /** 요약 */
    summary: {
        total: number;
        auto: number;
        suggest: number;
        excluded: number;
    };
    /** 상태별 제외 통계 */
    excludedByStatus: {
        completed: number;
        onHold: number;
        archived: number;
    };
    /** 스캔 시각 */
    scannedAt: string;
}
/**
 * SupplementScanner - 보완 분석 후보 스캐너
 *
 * 신규 프로젝트의 인덱스(screens, apis, components, models)와
 * 기존 분석 결과의 키워드를 비교하여 매칭도를 계산한다.
 */
export declare class SupplementScanner {
    private readonly basePath?;
    private readonly resultManager;
    constructor(basePath?: string);
    /**
     * 신규 프로젝트에 대해 보완 분석 후보 스캔
     *
     * @param newProjectId - 신규 프로젝트 ID
     * @returns 보완 분석 스캔 결과
     */
    scan(newProjectId: string): Promise<SupplementScanResult>;
    /**
     * 매칭도 계산 (내부용)
     *
     * 기존 분석 결과에서 추출한 키워드와 신규 프로젝트 인덱스의 키워드를 비교하여
     * 매칭도를 계산한다.
     *
     * 매칭도 = (매칭 키워드 수 / 기존 분석 키워드 수) * 100
     *
     * @param analysisResult - 기존 분석 결과
     * @param newProjectKeywords - 신규 프로젝트 인덱스에서 추출한 키워드
     * @returns 매칭도와 매칭된 키워드 목록
     */
    private calculateMatchRate;
    /**
     * 기존 분석 결과에서 키워드 추출
     *
     * 1. parsedSpec.keywords (있으면)
     * 2. analysisSummary.keyFindings에서 명사/키워드 추출
     * 3. impactedFiles(affectedScreens)에서 API 경로, 컴포넌트명 추출
     */
    private extractAnalysisKeywords;
    /**
     * 프로젝트 인덱스에서 키워드 추출
     */
    private extractIndexKeywords;
    /**
     * 키워드가 비어있는지 확인
     */
    private isEmptyKeywords;
    /**
     * 프로젝트 인덱스 로드
     */
    private loadProjectIndex;
    /**
     * 등록된 프로젝트 목록 로드
     */
    private loadProjects;
}
//# sourceMappingURL=supplement-scanner.d.ts.map