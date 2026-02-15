/**
 * @module core/spec/spec-parser
 * @description 기획서 파서 - 기획서를 파싱하여 구조화된 결과 반환
 */
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
 * 키워드 기반 규칙 파싱으로 기획서를 ParsedSpec 타입으로 구조화.
 * 외부에서 제공된 구조화 데이터도 parseFromStructuredInput()으로 수용 가능.
 */
export declare class SpecParser {
    /**
     * 기획서를 파싱하여 구조화된 결과 반환
     * @param input - 기획서 입력
     * @returns 파싱된 기획서
     */
    parse(input: SpecInput): Promise<ParsedSpec>;
    /**
     * 텍스트 입력 처리 (키워드 기반 규칙 파싱)
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
     * 외부에서 제공된 구조화된 데이터를 검증하여 ParsedSpec으로 변환
     *
     * Claude 등 외부 시스템이 생성한 JSON 데이터를 수용합니다.
     * 필수 필드 검증 및 기본값 적용을 통해 안전한 ParsedSpec을 생성합니다.
     *
     * @param data - 외부에서 제공된 구조화된 데이터
     * @returns 검증된 ParsedSpec
     */
    parseFromStructuredInput(data: unknown): ParsedSpec;
    /**
     * 키워드 기반 규칙 파싱
     * @param text - 기획서 텍스트
     * @returns 파싱 결과
     */
    private parseKeywordBased;
    /**
     * 텍스트에서 제목 추출
     * @param text - 기획서 텍스트
     * @returns 추출된 제목
     */
    private extractTitle;
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