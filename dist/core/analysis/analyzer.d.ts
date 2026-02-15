/**
 * @module core/analysis/analyzer
 * @description 영향도 분석기 - LLM 기반 영향도 심층 분석
 */
import { LLMRouter } from '../../llm/router';
import { ParsedSpec, MatchedEntities, ImpactResult } from '../../types/analysis';
import { CodeIndex } from '../../types/index';
/**
 * ImpactAnalyzer - 영향도 심층 분석
 *
 * LLM (Claude Sonnet)으로 영향도 심층 분석.
 * LLM 미설정 시 규칙 기반 폴백 분석 제공.
 */
export declare class ImpactAnalyzer {
    private readonly llmRouter;
    constructor(llmRouter: LLMRouter);
    /**
     * 영향도 심층 분석 (LLM 사용)
     * @param spec - 파싱된 기획서
     * @param matched - 매칭된 엔티티
     * @param index - 코드 인덱스
     * @returns 영향도 분석 결과
     */
    analyze(spec: ParsedSpec, matched: MatchedEntities, index: CodeIndex): Promise<ImpactResult>;
    /**
     * LLM을 사용한 영향도 분석
     */
    private analyzeWithLLM;
    /**
     * LLM 없이 규칙 기반 분석 (폴백)
     * @param spec - 파싱된 기획서
     * @param matched - 매칭된 엔티티
     * @param index - 코드 인덱스
     * @returns 영향도 분석 결과
     */
    analyzeWithoutLLM(spec: ParsedSpec, matched: MatchedEntities, index: CodeIndex): ImpactResult;
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
     * LLM 응답 파싱
     */
    private parseLLMResponse;
    /**
     * LLM 응답을 ImpactResult로 변환
     *
     * Tech design R7: LLM 응답의 affectedFiles에 포함된 파일 경로가
     * 실제 인덱스에 존재하는지 검증하고, 존재하지 않는 경로는 자동 제거합니다.
     * 이를 통해 LLM hallucination으로 인한 허위 파일 경로를 방지합니다.
     *
     * @param spec - 파싱된 기획서
     * @param parsed - LLM 응답 파싱 결과
     * @param index - 코드 인덱스 (파일 경로 검증용, 선택)
     */
    private buildImpactResult;
    /**
     * 매칭된 엔티티에서 코드 스니펫 구성
     */
    private buildCodeSnippets;
    /**
     * 인덱스에서 유효한 파일 경로 집합을 구축
     *
     * files, screens, components, apis, models, policies의
     * 모든 파일 경로를 수집하여 LLM 응답 검증에 사용합니다.
     */
    private buildValidFilePathSet;
    /**
     * 프롬프트 템플릿 로드
     */
    private loadPromptTemplate;
}
//# sourceMappingURL=analyzer.d.ts.map