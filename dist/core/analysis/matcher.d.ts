/**
 * @module core/analysis/matcher
 * @description 인덱스 매처 - 기획서 키워드로 코드 인덱스 매칭
 */
import { ParsedSpec, MatchedEntities } from '../../types/analysis';
import { CodeIndex } from '../../types/index';
/**
 * IndexMatcher - 기획서 키워드로 코드 인덱스 매칭
 *
 * 기획서의 keywords + features에서 검색 쿼리를 추출하고
 * 코드 인덱스의 screens, components, apis, models와 텍스트 매칭 수행.
 * 매칭된 엔티티의 의존 그래프에서 1-hop 확장.
 */
export declare class IndexMatcher {
    /**
     * 기획서 키워드로 코드 인덱스 매칭
     * @param spec - 파싱된 기획서
     * @param index - 코드 인덱스
     * @returns 매칭된 엔티티들
     */
    match(spec: ParsedSpec, index: CodeIndex): MatchedEntities;
    /**
     * 기획서에서 검색 키워드 수집
     * @param spec - 파싱된 기획서
     * @returns 검색 키워드 배열
     */
    private collectKeywords;
    /**
     * 화면 매칭
     */
    private matchScreens;
    /**
     * 컴포넌트 매칭
     */
    private matchComponents;
    /**
     * API 매칭
     */
    private matchApis;
    /**
     * 모델 매칭
     */
    private matchModels;
    /**
     * 엔티티 하나에 대해 키워드 매칭 점수 계산
     * @param keywords - 검색 키워드 목록
     * @param targets - 매칭 대상 필드들
     * @returns 매칭 점수와 근거
     */
    private matchEntity;
    /**
     * 키워드와 대상 문자열의 유사도 점수 계산
     * @param keyword - 검색 키워드
     * @param target - 대상 문자열
     * @returns 유사도 점수 (0.0 ~ 1.0)
     */
    calculateSimilarity(keyword: string, target: string): number;
    /**
     * 의존 그래프 기반 1-hop 확장
     * @param matched - 초기 매칭 결과
     * @param graph - 의존성 그래프
     * @returns 확장된 매칭 결과
     */
    private expandByDependency;
}
//# sourceMappingURL=matcher.d.ts.map