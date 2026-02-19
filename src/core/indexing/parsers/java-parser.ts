/**
 * @module core/indexing/parsers/java-parser
 * @description Java 파서 - Regex 기반 Java 소스코드 분석 (Phase 1)
 *
 * Spring Boot 프로젝트의 Java 파일을 정규식으로 파싱하여
 * import, export(public class/method), 함수, 컴포넌트(Spring bean),
 * API 호출, 라우트 정의, 주석 등 구조화된 정보를 추출한다.
 */

import { BaseParser } from './base-parser';
import {
  ParsedFile,
  FunctionInfo,
} from '../types';
import {
  SPRING_ROUTE_ANNOTATIONS,
  parseAnnotationValue,
  resolveSpringHttpMethod,
  combineRoutePaths,
  isSpringComponent,
  isEntityClass,
  getLineNumber,
  stripStringsAndComments,
} from './jvm-parser-utils';
import { logger } from '../../../utils/logger';

/**
 * JavaParser - Regex 기반 Java 소스코드 분석기
 *
 * 지원 범위:
 *   - import 문 (단일/와일드카드)
 *   - public class/interface 선언 → export
 *   - 메서드 정의 → function
 *   - Spring @RestController/@Service/@Repository → component
 *   - @GetMapping/@PostMapping 등 → routeDefinition
 *   - @Autowired / 생성자 주입 → import (DI)
 *   - @Entity/@Table → model 힌트
 *   - 주석 추출 (line/block, 정책 주석 포함)
 */
export class JavaParser extends BaseParser {
  readonly name = 'java';
  readonly supportedExtensions = ['.java'];

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const result = this.createEmptyParsedFile(filePath);

    if (!content.trim()) {
      return result;
    }

    try {
      // 전처리: 문자열/주석 제거 → 구조 파싱 안전하게
      const { processed, comments } = stripStringsAndComments(content);

      // 주석 추출
      this.extractComments(comments, result);

      // import 파싱
      this.parseImports(content, result);

      // 패키지명 추출
      const packageName = this.parsePackage(content);

      // 클래스 레벨 어노테이션 수집
      const classAnnotations = this.parseClassAnnotations(processed);

      // 클래스 선언 파싱
      this.parseClassDeclaration(processed, content, filePath, classAnnotations, packageName, result);

      // 메서드 파싱
      this.parseMethods(processed, content, filePath, classAnnotations, result);

      // DI 패턴 파싱
      this.parseDIPatterns(processed, content, result);

    } catch (err) {
      logger.debug(`JavaParser failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
  }

  // ============================================================
  // Import 파싱
  // ============================================================

  private parseImports(content: string, result: ParsedFile): void {
    const importRegex = /^import\s+(static\s+)?([a-zA-Z_][\w.]*(?:\.\*)?)\s*;/gm;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const fullImport = match[2];
      const isStatic = !!match[1];
      const line = getLineNumber(content, match.index);

      // 패키지와 클래스 분리
      const lastDot = fullImport.lastIndexOf('.');
      const source = lastDot !== -1 ? fullImport.substring(0, lastDot) : fullImport;
      const specifier = lastDot !== -1 ? fullImport.substring(lastDot + 1) : fullImport;

      result.imports.push({
        source,
        specifiers: isStatic ? [`static ${specifier}`] : [specifier],
        isDefault: false,
        line,
      });
    }
  }

  // ============================================================
  // 패키지 파싱
  // ============================================================

  private parsePackage(content: string): string {
    const match = content.match(/^package\s+([\w.]+)\s*;/m);
    return match ? match[1] : '';
  }

  // ============================================================
  // 클래스 어노테이션 파싱
  // ============================================================

  private parseClassAnnotations(processed: string): string[] {
    const annotations: string[] = [];
    // 클래스 선언 이전의 어노테이션들 수집
    const classMatch = processed.match(/((?:\s*@\w+(?:\([^)]*\))?\s*)*)\s*(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+\w+/);
    if (classMatch && classMatch[1]) {
      const annoBlock = classMatch[1];
      const annoRegex = /@(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = annoRegex.exec(annoBlock)) !== null) {
        annotations.push(m[1]);
      }
    }
    return annotations;
  }

  // ============================================================
  // 클래스 선언 파싱
  // ============================================================

  private parseClassDeclaration(
    processed: string,
    content: string,
    filePath: string,
    classAnnotations: string[],
    _packageName: string,
    result: ParsedFile,
  ): void {
    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = classRegex.exec(processed)) !== null) {
      const className = match[1];
      const line = getLineNumber(content, match.index);

      // public class → export
      if (processed.substring(Math.max(0, match.index - 10), match.index).includes('public')) {
        result.exports.push({
          name: className,
          type: 'named',
          kind: 'class',
          line,
        });
      }

      // Spring 컴포넌트 판별
      if (isSpringComponent(classAnnotations)) {
        result.components.push({
          name: className,
          type: 'function-component', // Java class도 component로 매핑
          props: classAnnotations,
          filePath,
          line,
        });
      }

      // Entity 판별 → model 힌트 (components에 추가)
      if (isEntityClass(classAnnotations)) {
        result.components.push({
          name: className,
          type: 'class-component',
          props: ['@Entity'],
          filePath,
          line,
        });
      }
    }
  }

  // ============================================================
  // 메서드 파싱
  // ============================================================

  private parseMethods(
    processed: string,
    content: string,
    filePath: string,
    _classAnnotations: string[],
    result: ParsedFile,
  ): void {
    // 메서드 앞의 어노테이션 + 메서드 시그니처 매칭
    const methodRegex = /((?:\s*@\w+(?:\([^)]*\))?)*)\s*(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:<[\w<>,?\s]+>\s+)?([\w<>\[\],?\s]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
    let match: RegExpExecArray | null;

    // 클래스 레벨 @RequestMapping 경로 추출
    let classBasePath = '';
    const classAnnoBlock = processed.match(/((?:\s*@\w+(?:\([^)]*\))?\s*)*)\s*(?:public\s+)?(?:abstract\s+)?class/);
    if (classAnnoBlock && classAnnoBlock[1]) {
      const rmMatch = classAnnoBlock[1].match(/@RequestMapping\s*(\([^)]*\))?/);
      if (rmMatch) {
        classBasePath = parseAnnotationValue(`@RequestMapping${rmMatch[1] || '("/")'}`);
      }
    }

    while ((match = methodRegex.exec(processed)) !== null) {
      const annotationBlock = match[1] || '';
      const returnType = match[2].trim();
      const methodName = match[3];
      const paramsStr = match[4];
      const line = getLineNumber(content, match.index);

      // 생성자는 건너뛰기 (반환 타입이 클래스 이름과 동일)
      if (returnType === methodName) continue;

      // 메서드 어노테이션 추출
      const methodAnnotations: string[] = [];
      const annoRegex = /@(\w+)/g;
      let annoMatch: RegExpExecArray | null;
      while ((annoMatch = annoRegex.exec(annotationBlock)) !== null) {
        methodAnnotations.push(annoMatch[1]);
      }

      // 파라미터 파싱
      const params = this.parseMethodParams(paramsStr);

      // 메서드 종료 라인 추정 (간이: 다음 메서드 시작 또는 클래스 종료)
      const endLine = this.estimateMethodEndLine(content, match.index);

      const isAsync = returnType.includes('CompletableFuture') || 
                      returnType.includes('Mono') || 
                      returnType.includes('Flux');

      const funcInfo: FunctionInfo = {
        name: methodName,
        signature: `${returnType} ${methodName}(${paramsStr.trim()})`,
        startLine: line,
        endLine,
        params,
        returnType,
        isAsync,
        isExported: processed.substring(Math.max(0, match.index - 30), match.index + match[0].length).includes('public'),
      };

      result.functions.push(funcInfo);

      // Spring 라우트 어노테이션 확인
      for (const anno of methodAnnotations) {
        if (SPRING_ROUTE_ANNOTATIONS.includes(anno)) {
          const annoText = this.extractAnnotationText(annotationBlock, anno);
          const methodPath = parseAnnotationValue(annoText);
          const fullPath = combineRoutePaths(classBasePath, methodPath);
          const httpMethod = resolveSpringHttpMethod(anno, annoText);

          result.routeDefinitions.push({
            path: fullPath || '/',
            component: `${httpMethod} ${methodName}`,
            filePath,
            line,
          });
        }
      }
    }
  }

  // ============================================================
  // DI 패턴 파싱
  // ============================================================

  private parseDIPatterns(processed: string, content: string, result: ParsedFile): void {
    // @Autowired 필드 주입
    const fieldDIRegex = /@(?:Autowired|Inject|Resource)\s+(?:private\s+|protected\s+)?(\w+)\s+(\w+)\s*;/g;
    let match: RegExpExecArray | null;

    while ((match = fieldDIRegex.exec(processed)) !== null) {
      const typeName = match[1];
      const fieldName = match[2];
      const line = getLineNumber(content, match.index);

      result.imports.push({
        source: typeName,
        specifiers: [`@Autowired ${fieldName}`],
        isDefault: false,
        line,
      });
    }

    // 생성자 주입 패턴 (Spring 권장 방식)
    const constructorRegex = /(?:public\s+)?(\w+)\s*\(((?:\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:final\s+)?[\w<>\[\],?\s]+\s+\w+\s*,?\s*)+)\)\s*\{/g;
    while ((match = constructorRegex.exec(processed)) !== null) {
      const paramsStr = match[2];
      const line = getLineNumber(content, match.index);

      // 각 파라미터에서 타입 추출
      const paramRegex = /(?:final\s+)?([\w<>\[\]]+)\s+(\w+)/g;
      let paramMatch: RegExpExecArray | null;
      while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
        const typeName = paramMatch[1];
        // primitive/wrapper 타입은 건너뛰기
        if (['int', 'long', 'double', 'float', 'boolean', 'String', 'byte', 'short', 'char'].includes(typeName)) continue;

        result.imports.push({
          source: typeName,
          specifiers: [`constructor-injection`],
          isDefault: false,
          line,
        });
      }
    }
  }

  // ============================================================
  // 주석 추출
  // ============================================================

  private extractComments(
    comments: Array<{ text: string; line: number; type: 'line' | 'block' }>,
    result: ParsedFile,
  ): void {
    const policyPatterns = [
      /^\/\/\s*정책\s*:/,
      /^\/\/\s*Policy\s*:/i,
      /^\/\*\s*정책\s*:/,
      /^\/\*\s*Policy\s*:/i,
      /^\/\/\s*@policy/i,
      /^\/\*\s*@policy/i,
    ];

    for (const comment of comments) {
      const isPolicy = policyPatterns.some(p => p.test(comment.text.trim()));
      result.comments.push({
        text: comment.text,
        line: comment.line,
        type: comment.type,
        isPolicy,
      });
    }
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  private parseMethodParams(paramsStr: string): { name: string; type?: string }[] {
    if (!paramsStr.trim()) return [];

    const params: { name: string; type?: string }[] = [];
    // 어노테이션 제거 후 파라미터 분리
    const cleaned = paramsStr.replace(/@\w+(?:\([^)]*\))?\s*/g, '');
    const parts = cleaned.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // "Type name" 또는 "final Type name" 패턴
      const paramMatch = trimmed.match(/(?:final\s+)?([\w<>\[\]?.]+)\s+(\w+)$/);
      if (paramMatch) {
        params.push({
          name: paramMatch[2],
          type: paramMatch[1],
        });
      }
    }

    return params;
  }

  private estimateMethodEndLine(content: string, methodStartOffset: number): number {
    let braceCount = 0;
    let foundFirst = false;
    let i = methodStartOffset;

    while (i < content.length) {
      if (content[i] === '{') {
        braceCount++;
        foundFirst = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (foundFirst && braceCount === 0) {
          return getLineNumber(content, i);
        }
      }
      i++;
    }

    return getLineNumber(content, content.length - 1);
  }

  private extractAnnotationText(annotationBlock: string, annotationName: string): string {
    const regex = new RegExp(`@${annotationName}(\\([^)]*\\))?`);
    const match = annotationBlock.match(regex);
    if (match) {
      return `@${annotationName}${match[1] || ''}`;
    }
    return `@${annotationName}`;
  }
}
