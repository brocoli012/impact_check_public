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
import { logger } from '../../../utils/logger';

export class ParsedFileNormalizer {
  /**
   * ParsedFile 정규화 (AST vs Regex 차이 제거)
   * @param parsed - 파싱된 파일 정보
   * @param parserType - 파서 유형 ('ast' | 'regex')
   * @returns 정규화된 ParsedFile
   */
  normalize(parsed: ParsedFile, parserType: 'ast' | 'regex'): ParsedFile {
    const normalized = { ...parsed };

    try {
      // 1. exports: className 정규화 (중첩 클래스 처리)
      if (normalized.exports) {
        normalized.exports = normalized.exports.map(exp => ({
          ...exp,
          name: parserType === 'ast' && exp.name.includes('.')
            ? exp.name.split('.').pop()!
            : exp.name,
          line: Math.max(1, exp.line),
        }));
      }

      // 2. imports: line 번호 검증
      if (normalized.imports) {
        normalized.imports = normalized.imports.map(imp => ({
          ...imp,
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
      if (normalized.components) {
        normalized.components = normalized.components.map(comp => ({
          ...comp,
          name: parserType === 'ast' && comp.name.includes('.')
            ? comp.name.split('.').pop()!
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

    } catch (err) {
      logger.debug(`ParsedFileNormalizer failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return normalized;
  }

  /**
   * Signature 문자열 정규화 (연속 공백 → 단일 공백)
   * @param signature - 원본 signature
   * @returns 정규화된 signature
   */
  private normalizeSignature(signature: string): string {
    return signature.replace(/\s+/g, ' ').trim();
  }
}
