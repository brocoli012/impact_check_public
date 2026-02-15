/**
 * @module core/spec/spec-parser
 * @description 기획서 파서 - 기획서를 파싱하여 구조화된 결과 반환
 */
import { LLMRouter } from '../../llm/router';
import { ParsedSpec } from '../../types/analysis';
/** 기획서 입력 타입 */
export interface SpecInput {
    /** 입력 유형 */
    type: 'text' | 'pdf';
    /** 텍스트 직접 입력 */
    content?: string;
    /** PDF 파일 경로 */
    filePath?: string;
}
/**
 * SpecParser - 기획서를 파싱하여 구조화된 결과 반환
 *
 * LLM을 사용하여 기획서를 ParsedSpec 타입으로 구조화.
 * LLM 미설정 시 키워드 기반 폴백 모드로 동작.
 */
export declare class SpecParser {
    private readonly llmRouter;
    /**
     * SpecParser 생성
     * @param llmRouter - LLM 라우터 인스턴스
     */
    constructor(llmRouter: LLMRouter);
    /**
     * 기획서를 파싱하여 구조화된 결과 반환
     * @param input - 기획서 입력
     * @returns 파싱된 기획서
     */
    parse(input: SpecInput): Promise<ParsedSpec>;
    /**
     * 텍스트 입력 처리
     * @param text - 기획서 텍스트
     * @returns 파싱된 기획서
     */
    private parseText;
    /**
     * PDF 입력 처리
     * @param filePath - PDF 파일 경로
     * @returns 파싱된 기획서
     */
    private parsePdf;
    /**
     * PDF에서 텍스트 추출
     * @param filePath - PDF 파일 절대 경로
     * @returns 추출된 텍스트
     */
    private extractTextFromPdf;
    /**
     * LLM을 사용한 기획서 파싱
     * @param text - 기획서 텍스트
     * @returns 파싱된 기획서
     */
    private parseWithLLM;
    /**
     * LLM 응답을 파싱하여 구조화된 결과로 변환
     * @param content - LLM 응답 내용
     * @returns 파싱된 결과 (ParsedSpec 부분)
     */
    private parseLLMResponse;
    /**
     * LLM 파싱 결과를 완전한 ParsedSpec으로 보강
     * @param partial - 부분 파싱 결과
     * @param originalText - 원본 텍스트
     * @returns 완전한 ParsedSpec
     */
    private enrichParsedSpec;
    /**
     * 텍스트에서 제목 추출 (폴백)
     * @param text - 기획서 텍스트
     * @returns 추출된 제목
     */
    private extractTitle;
    /**
     * 프롬프트 템플릿 로드
     * @returns 프롬프트 템플릿 문자열
     */
    private loadPromptTemplate;
    /**
     * LLM 없이 키워드 기반 간단 파싱 (폴백 모드)
     * @param text - 기획서 텍스트
     * @returns 폴백 파싱 결과
     */
    fallbackParse(text: string): ParsedSpec;
    /**
     * 텍스트에서 키워드 추출
     */
    private extractKeywords;
    /**
     * 텍스트에서 기능 추출
     */
    private extractFeaturesFromText;
    /**
     * 줄이 기능 설명인지 판단
     */
    private looksLikeFeature;
    /**
     * 라인의 다음 줄들에서 설명 추출
     */
    private getDescriptionForLine;
    /**
     * 작업 유형 추론
     */
    private inferActionType;
    /**
     * 대상 화면 추론
     */
    private inferTargetScreen;
    /**
     * 줄에서 키워드 추출
     */
    private extractKeywordsFromLine;
    /**
     * 텍스트에서 비즈니스 규칙 추출
     */
    private extractBusinessRulesFromText;
    /**
     * 텍스트에서 대상 화면 추출
     */
    private extractTargetScreensFromText;
}
//# sourceMappingURL=spec-parser.d.ts.map