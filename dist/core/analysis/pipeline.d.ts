/**
 * @module core/analysis/pipeline
 * @description 분석 파이프라인 오케스트레이터 - 전체 분석 파이프라인 실행
 */
import { LLMRouter } from '../../llm/router';
import { ConfidenceEnrichedResult } from '../../types/analysis';
import { SpecInput } from '../spec/spec-parser';
/** 파이프라인 진행 콜백 */
export type ProgressCallback = (step: number, totalSteps: number, message: string) => void;
/**
 * AnalysisPipeline - 전체 분석 파이프라인 오케스트레이터
 *
 * Step 1: 기획서 파싱 (SpecParser)
 * Step 2: 인덱스 매칭 (IndexMatcher)
 * Step 3: 영향도 분석 (ImpactAnalyzer)
 * Step 4: 점수 산출 (Scorer)
 * Step 5: 정책 매칭 + 담당자 매핑 (PolicyMatcher + OwnerMapper)
 * Step 6: 신뢰도 산출 (ConfidenceScorer)
 */
export declare class AnalysisPipeline {
    private readonly specParser;
    private readonly indexMatcher;
    private readonly impactAnalyzer;
    private readonly scorer;
    private readonly policyMatcher;
    private readonly ownerMapper;
    private readonly confidenceScorer;
    private readonly resultManager;
    private readonly indexer;
    private onProgress?;
    constructor(llmRouter: LLMRouter, basePath?: string);
    /**
     * 진행률 콜백 설정
     */
    setProgressCallback(callback: ProgressCallback): void;
    /**
     * 전체 분석 파이프라인 실행
     *
     * Tech design에서는 7단계 파이프라인을 정의하지만, run()은 6단계로 구현됩니다.
     * 7번째 단계(결과 직렬화/저장)는 별도의 saveResult() 메서드로 분리되어 있습니다.
     * 이는 호출자가 분석 결과를 저장 전에 검사하거나 수정할 수 있도록
     * 의도적으로 설계된 구조입니다.
     *
     * Design-to-implementation step mapping:
     *   Design Step 1 → run() Step 1: 기획서 파싱 (SpecParser)
     *   Design Step 2 → run() Step 2: 인덱스 매칭 (IndexMatcher)
     *   Design Step 3 → run() Step 3: 영향도 분석 (ImpactAnalyzer)
     *   Design Step 4 → run() Step 4: 점수 산출 (Scorer)
     *   Design Step 5 → run() Step 5: 정책 매칭 + 담당자 매핑 (PolicyMatcher + OwnerMapper)
     *   Design Step 6 → run() Step 6: 신뢰도 산출 (ConfidenceScorer)
     *   Design Step 7 → saveResult(): 결과 직렬화/저장 (ResultManager)
     *
     * @param input - 기획서 입력
     * @param projectId - 프로젝트 ID
     * @param basePath - Base path for loading the code index and owners config.
     *   Note: This is separate from the constructor's `basePath` which is used
     *   for result storage (via ResultManager). If the caller wants both to
     *   refer to the same directory, pass the same value to both the
     *   constructor and this method.
     * @returns 신뢰도 보강 결과
     */
    run(input: SpecInput, projectId: string, basePath?: string): Promise<ConfidenceEnrichedResult>;
    /**
     * 결과 직렬화 및 저장 (Design Step 7)
     *
     * run()과 분리된 이유: 호출자가 분석 결과를 저장 전에 검사하거나
     * 수정(예: 필터링, 추가 보강)할 수 있도록 하기 위함입니다.
     *
     * @param result - 분석 결과
     * @param projectId - 프로젝트 ID
     * @returns 결과 ID
     */
    saveResult(result: ConfidenceEnrichedResult, projectId: string): Promise<string>;
    /**
     * 코드 인덱스 로드
     */
    private loadCodeIndex;
    /**
     * 담당자 설정 로드
     */
    private loadOwnersConfig;
    /**
     * 진행률 보고
     */
    private reportProgress;
}
//# sourceMappingURL=pipeline.d.ts.map