/**
 * @module core/indexing/domain-extractor
 * @description CodeIndex에서 비즈니스 도메인 키워드와 기능 요약을 추출
 */
import { CodeIndex } from '../../types/index';
/** 도메인 추출 결과 */
export interface DomainExtractionResult {
    /** 추출된 도메인 키워드 목록 (한국어) */
    domains: string[];
    /** 기능 요약 목록 */
    featureSummary: string[];
}
/**
 * DomainExtractor - CodeIndex에서 비즈니스 도메인과 기능 요약을 추출
 */
export declare class DomainExtractor {
    /**
     * CodeIndex에서 비즈니스 도메인 키워드와 기능 요약을 추출
     * @param codeIndex - 전체 코드 인덱스
     * @returns 도메인 키워드와 기능 요약
     */
    extract(codeIndex: CodeIndex): DomainExtractionResult;
    /**
     * 도메인별 매칭 점수를 계산
     * API 경로, 화면/라우트명, 모델/엔티티명, 디렉토리 구조를 분석
     */
    private computeDomainScores;
    /**
     * 텍스트에 키워드가 포함되는지 확인 (단어 경계 고려)
     */
    private containsKeyword;
    /**
     * 파일 경로에서 디렉토리 이름 기준 키워드 매칭
     */
    private containsKeywordInPath;
    /**
     * 점수 기반으로 상위 도메인을 선택 (최소 점수 임계값 적용)
     */
    private selectTopDomains;
    /**
     * 화면/API 그룹별 기능 요약을 생성
     * 최대 10개 항목 반환
     */
    private generateFeatureSummary;
    /**
     * API를 경로 prefix (첫 2 세그먼트)로 그룹핑
     */
    private groupApisByPrefix;
    /**
     * API 경로에서 prefix 추출 (예: /api/orders/123 → orders)
     */
    private extractApiPrefix;
    /**
     * 화면을 도메인별로 그룹핑
     */
    private groupScreensByDomain;
    /**
     * 화면에서 도메인 추론
     */
    private inferScreenDomain;
    /**
     * 화면 그룹에 관련된 API 수를 계산
     */
    private countRelatedApis;
    /**
     * API prefix에서 도메인 라벨을 추론
     */
    private inferDomainFromPrefix;
}
//# sourceMappingURL=domain-extractor.d.ts.map