/**
 * @module core/analysis/analyzer
 * @description 영향도 분석기 - 규칙 기반 영향도 심층 분석
 */
import { ParsedSpec, MatchedEntities, ImpactResult } from '../../types/analysis';
import { CodeIndex } from '../../types/index';
/**
 * ImpactAnalyzer - 영향도 심층 분석
 *
 * 규칙 기반으로 영향도를 심층 분석합니다.
 */
export declare class ImpactAnalyzer {
    /**
     * 영향도 심층 분석 (규칙 기반)
     * @param spec - 파싱된 기획서
     * @param matched - 매칭된 엔티티
     * @param index - 코드 인덱스
     * @returns 영향도 분석 결과
     */
    analyze(spec: ParsedSpec, matched: MatchedEntities, index: CodeIndex): Promise<ImpactResult>;
    /**
     * 화면별 작업 생성
     */
    private generateTasksForScreen;
    /**
     * 기능이 화면과 관련 있는지 판단
     */
    private isFeatureRelevantToScreen;
    /**
     * 추가 작업 생성 (API/BE 작업)
     */
    private generateAdditionalTasks;
    /**
     * 영향도 수준 결정
     */
    private determineImpactLevel;
    /**
     * 기획 확인 사항 생성
     */
    private generatePlanningChecks;
    /**
     * 정책 변경 사항 감지
     */
    private detectPolicyChanges;
    /** 매칭에서 제외할 한국어 불용어 목록 */
    private static readonly KOREAN_STOP_WORDS;
    /**
     * 두 텍스트 간 키워드 중복 확인
     */
    private hasOverlap;
    /**
     * 인덱스에서 유효한 파일 경로 집합을 구축
     *
     * files, screens, components, apis, models, policies의
     * 모든 파일 경로를 수집하여 결과 검증에 사용합니다.
     */
    buildValidFilePathSet(index: CodeIndex): Set<string>;
}
//# sourceMappingURL=analyzer.d.ts.map