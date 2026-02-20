/**
 * @module core/indexing/parsers/parsed-file-normalizer
 * @description AST vs Regex 파서 결과를 정규화하여 일관된 형태로 변환
 *
 * 정규화 항목:
 *   1. className 정규화 (AST: "OuterClass.InnerClass" → "InnerClass")
 *   2. line 번호 검증 (음수/0 방지, endLine >= startLine 보장)
 *   3. signature 공백 정규화
 */
import { ParsedFile } from '../types';
export declare class ParsedFileNormalizer {
    /**
     * ParsedFile 정규화 (AST vs Regex 차이 제거)
     * @param parsed - 파싱된 파일 정보
     * @param parserType - 파서 유형 ('ast' | 'regex')
     * @returns 정규화된 ParsedFile
     */
    normalize(parsed: ParsedFile, parserType: 'ast' | 'regex'): ParsedFile;
    /**
     * Signature 문자열 정규화 (연속 공백 → 단일 공백)
     * @param signature - 원본 signature
     * @returns 정규화된 signature
     */
    private normalizeSignature;
}
//# sourceMappingURL=parsed-file-normalizer.d.ts.map