"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParsedFileNormalizer = exports.StringInterner = void 0;
const logger_1 = require("../../../utils/logger");
/**
 * TASK-043: StringInterner - 동일 문자열을 단일 참조로 공유
 *
 * Java/Kotlin 프로젝트에서 동일한 import 문자열 (예: "org.springframework.stereotype.Service")이
 * 수백 파일에서 반복되는 경우, 각 문자열을 Map에 캐싱하여 메모리 중복을 제거한다.
 */
class StringInterner {
    constructor() {
        this.pool = new Map();
    }
    /**
     * 문자열을 인터닝하여 동일 참조 반환
     * @param str - 인터닝할 문자열
     * @returns 풀에 저장된 동일 문자열 참조
     */
    intern(str) {
        const existing = this.pool.get(str);
        if (existing !== undefined) {
            return existing;
        }
        this.pool.set(str, str);
        return str;
    }
    /** 풀 크기 (디버그용) */
    get size() {
        return this.pool.size;
    }
    /** 풀 해제 */
    clear() {
        this.pool.clear();
    }
}
exports.StringInterner = StringInterner;
class ParsedFileNormalizer {
    constructor() {
        // TASK-043: 인스턴스 간 공유되는 문자열 인터닝 풀
        this.stringInterner = new StringInterner();
    }
    /**
     * ParsedFile 정규화 (AST vs Regex 차이 제거)
     * @param parsed - 파싱된 파일 정보
     * @param parserType - 파서 유형 ('ast' | 'regex')
     * @returns 정규화된 ParsedFile
     */
    normalize(parsed, parserType) {
        const normalized = { ...parsed };
        try {
            // 1. exports: className 정규화 (중첩 클래스 처리)
            // TASK-065: Outer.Inner → Outer$Inner (Java 관행, 계층 정보 보존)
            if (normalized.exports) {
                normalized.exports = normalized.exports.map(exp => ({
                    ...exp,
                    name: parserType === 'ast' && exp.name.includes('.')
                        ? exp.name.replace(/\./g, '$')
                        : exp.name,
                    line: Math.max(1, exp.line),
                }));
            }
            // 2. imports: line 번호 검증 + TASK-043: 문자열 인터닝 + TASK-067: wildcard 통일
            if (normalized.imports) {
                normalized.imports = normalized.imports.map(imp => ({
                    ...imp,
                    // TASK-067: wildcard import source 통일 (AST: "pkg.*" → "pkg", Regex는 이미 "pkg")
                    // TASK-043: import source 문자열 인터닝
                    source: this.stringInterner.intern(this.normalizeImportSource(imp.source)),
                    specifiers: imp.specifiers.map(s => this.stringInterner.intern(s)),
                    line: Math.max(1, imp.line),
                }));
            }
            // 3. functions: line 번호 + signature 정규화
            if (normalized.functions) {
                normalized.functions = normalized.functions.map(fn => ({
                    ...fn,
                    startLine: Math.max(1, fn.startLine),
                    endLine: Math.max(fn.startLine || 1, fn.endLine),
                    signature: this.normalizeSignature(fn.signature),
                }));
            }
            // 4. components: className 정규화
            // TASK-065: Outer.Inner → Outer$Inner (Java 관행, 계층 정보 보존)
            if (normalized.components) {
                normalized.components = normalized.components.map(comp => ({
                    ...comp,
                    name: parserType === 'ast' && comp.name.includes('.')
                        ? comp.name.replace(/\./g, '$')
                        : comp.name,
                    line: Math.max(1, comp.line),
                }));
            }
            // 5. routeDefinitions: line 번호 검증
            if (normalized.routeDefinitions) {
                normalized.routeDefinitions = normalized.routeDefinitions.map(rd => ({
                    ...rd,
                    line: Math.max(1, rd.line),
                }));
            }
            // 6. comments: line 번호 검증
            if (normalized.comments) {
                normalized.comments = normalized.comments.map(c => ({
                    ...c,
                    line: Math.max(1, c.line),
                }));
            }
        }
        catch (err) {
            logger_1.logger.debug(`ParsedFileNormalizer failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return normalized;
    }
    /**
     * TASK-043: 인터닝 풀 통계 반환 (디버그용)
     */
    get internPoolSize() {
        return this.stringInterner.size;
    }
    /**
     * TASK-067: import source 정규화
     * AST 파서는 wildcard import를 "pkg.*"로, Regex 파서는 "pkg"로 기록하므로
     * 후행 ".*"를 제거하여 통일된 형태로 변환한다.
     * @param source - 원본 import source
     * @returns 정규화된 import source
     */
    normalizeImportSource(source) {
        return source.endsWith('.*') ? source.slice(0, -2) : source;
    }
    /**
     * Signature 문자열 정규화 (연속 공백 → 단일 공백)
     * @param signature - 원본 signature
     * @returns 정규화된 signature
     */
    normalizeSignature(signature) {
        return signature.replace(/\s+/g, ' ').trim();
    }
}
exports.ParsedFileNormalizer = ParsedFileNormalizer;
//# sourceMappingURL=parsed-file-normalizer.js.map