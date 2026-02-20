/**
 * @module core/indexing/parsers/parsed-file-normalizer
 * @description AST vs Regex 파서 결과를 정규화하여 일관된 형태로 변환
 *
 * 정규화 항목:
 *   1. className 정규화 (AST: "OuterClass.InnerClass" → "OuterClass$InnerClass")
 *   2. line 번호 검증 (음수/0 방지, endLine >= startLine 보장)
 *   3. signature 공백 정규화
 *   4. TASK-043: import 문자열 인터닝 (동일 import source 공유)
 *   5. TASK-067: wildcard import source 통일 ("pkg.*" → "pkg")
 */
import { ParsedFile } from '../types';
/**
 * TASK-043: StringInterner - 동일 문자열을 단일 참조로 공유
 *
 * Java/Kotlin 프로젝트에서 동일한 import 문자열 (예: "org.springframework.stereotype.Service")이
 * 수백 파일에서 반복되는 경우, 각 문자열을 Map에 캐싱하여 메모리 중복을 제거한다.
 */
export declare class StringInterner {
    private readonly pool;
    /**
     * 문자열을 인터닝하여 동일 참조 반환
     * @param str - 인터닝할 문자열
     * @returns 풀에 저장된 동일 문자열 참조
     */
    intern(str: string): string;
    /** 풀 크기 (디버그용) */
    get size(): number;
    /** 풀 해제 */
    clear(): void;
}
export declare class ParsedFileNormalizer {
    private readonly stringInterner;
    /**
     * ParsedFile 정규화 (AST vs Regex 차이 제거)
     * @param parsed - 파싱된 파일 정보
     * @param parserType - 파서 유형 ('ast' | 'regex')
     * @returns 정규화된 ParsedFile
     */
    normalize(parsed: ParsedFile, parserType: 'ast' | 'regex'): ParsedFile;
    /**
     * TASK-043: 인터닝 풀 통계 반환 (디버그용)
     */
    get internPoolSize(): number;
    /**
     * TASK-067: import source 정규화
     * AST 파서는 wildcard import를 "pkg.*"로, Regex 파서는 "pkg"로 기록하므로
     * 후행 ".*"를 제거하여 통일된 형태로 변환한다.
     * @param source - 원본 import source
     * @returns 정규화된 import source
     */
    private normalizeImportSource;
    /**
     * Signature 문자열 정규화 (연속 공백 → 단일 공백)
     * @param signature - 원본 signature
     * @returns 정규화된 signature
     */
    private normalizeSignature;
}
//# sourceMappingURL=parsed-file-normalizer.d.ts.map