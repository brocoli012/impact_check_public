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
  buildLineOffsetTable,
  getLineFromTable,
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
      const lineTable = buildLineOffsetTable(content);
      const { processed, comments } = stripStringsAndComments(content);

      // 주석 추출
      this.extractComments(comments, result);

      // import 파싱
      this.parseImports(content, lineTable, result);

      // 패키지명 추출
      const packageName = this.parsePackage(content);

      // 클래스 레벨 어노테이션 수집
      const classAnnotations = this.parseClassAnnotations(processed);

      // 클래스 선언 파싱
      this.parseClassDeclaration(processed, content, lineTable, filePath, classAnnotations, packageName, result);

      // 메서드 파싱
      this.parseMethods(processed, content, lineTable, filePath, classAnnotations, result);

      // DI 패턴 파싱
      this.parseDIPatterns(processed, content, lineTable, result);

    } catch (err) {
      logger.debug(`JavaParser failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
  }

  // ============================================================
  // Import 파싱
  // ============================================================

  private parseImports(content: string, lineTable: number[], result: ParsedFile): void {
    const importRegex = /^import\s+(static\s+)?([a-zA-Z_][\w.]*(?:\.\*)?)\s*;/gm;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const fullImport = match[2];
      const isStatic = !!match[1];
      const line = getLineFromTable(lineTable, match.index);

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
    const classMatch = processed.match(/(?:@\w+(?:\([^)]*\))?\s*)*\s*(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+\w+/);
    if (classMatch) {
      const annoBlock = classMatch[0].split(/(?:public|abstract|class|interface|enum|record)/)[0];
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
    _content: string,
    lineTable: number[],
    filePath: string,
    classAnnotations: string[],
    _packageName: string,
    result: ParsedFile,
  ): void {
    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+(\w+)(?:\s*<[^>]*>)?(?:\s*\([^)]*\))?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = classRegex.exec(processed)) !== null) {
      const className = match[1];
      const line = getLineFromTable(lineTable, match.index);

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


      // Java record 필드 파싱
      const recordPrefix = processed.substring(Math.max(0, match.index - 20), match.index + 10);
      if (recordPrefix.includes('record')) {
        this.parseRecordFields(processed, lineTable, className, filePath, match.index, result);
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
    _content: string,
    lineTable: number[],
    filePath: string,
    classAnnotations: string[],
    result: ParsedFile,
  ): void {
    // @Configuration 클래스 여부 확인 (@Bean DI 감지용)
    const isConfigurationClass = classAnnotations.includes('Configuration');
    const isAspectClass = classAnnotations.includes('Aspect');

    let classBasePath = '';
    const classAnnoBlock = processed.match(/(?:@\w+(?:\([^)]*\))?\s*)*\s*(?:public\s+)?(?:abstract\s+)?class/);
    if (classAnnoBlock) {
      const annoBlock = classAnnoBlock[0].split(/(?:public|abstract|class)/)[0];
      const rmMatch = annoBlock.match(/@RequestMapping\s*(\([^)]*\))?/);
      if (rmMatch) {
        classBasePath = parseAnnotationValue(`@RequestMapping${rmMatch[1] || '("/")'}`);
      }
    }

    // TASK-040: 2-pass 방식으로 분리하여 Regex 안전성 강화
    // Pass 1: 메서드 시그니처 매칭 (단순화된 정규식, lazy quantifier 제거)
    // 어노테이션 블록은 별도로 역추적하여 추출
    const methodSigRegex = /(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:<[^>]+>\s+)?([\w<>\[\],?\s]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
    let match: RegExpExecArray | null;

    while ((match = methodSigRegex.exec(processed)) !== null) {
      const returnType = match[1].trim();
      const methodName = match[2];
      const paramsStr = match[3];
      const methodStartOffset = match.index;
      const line = getLineFromTable(lineTable, methodStartOffset);

      // 생성자는 건너뛰기 (반환 타입이 클래스 이름과 동일)
      if (returnType === methodName) continue;

      // Pass 2: 어노테이션 블록 역추적 추출 (char-by-char)
      const annotationBlock = this.extractAnnotationBlockBefore(processed, methodStartOffset);

      // 메서드 어노테이션 추출
      const methodAnnotations: string[] = [];
      const annoRegex = /@(\w+)/g;
      let annoMatch: RegExpExecArray | null;
      while ((annoMatch = annoRegex.exec(annotationBlock)) !== null) {
        methodAnnotations.push(annoMatch[1]);
      }


      // @Bean 메서드 파라미터 → DI (Configuration 클래스에서만)
      if (isConfigurationClass && methodAnnotations.includes('Bean')) {
        const beanParams = this.parseMethodParams(paramsStr);
        for (const param of beanParams) {
          if (param.type && !['int', 'long', 'double', 'float', 'boolean', 'String', 'byte', 'short', 'char', 'void'].includes(param.type)) {
            result.imports.push({
              source: param.type,
              specifiers: ['@Bean method DI'],
              isDefault: false,
              line,
            });
          }
        }
      }

      // 파라미터 파싱
      const params = this.parseMethodParams(paramsStr);

      // 메서드 종료 라인 추정 (간이: 다음 메서드 시작 또는 클래스 종료)
      const endLine = this.estimateMethodEndLine(processed, lineTable, methodStartOffset);

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
        isExported: processed.substring(Math.max(0, methodStartOffset - 10), methodStartOffset + 10).includes('public'),
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

      // @Aspect 클래스의 AOP 어노테이션 (포인트컷 추출)
      if (isAspectClass) {
        const aopAnnotations = ['Around', 'Before', 'After', 'AfterReturning', 'AfterThrowing'];
        for (const aopAnno of aopAnnotations) {
          if (methodAnnotations.includes(aopAnno)) {
            const pointcut = this.extractPointcut(annotationBlock, aopAnno);
            if (pointcut) {
              result.apiCalls.push({
                method: aopAnno,
                url: pointcut,
                line,
                callerFunction: methodName,
              });
            }
          }
        }
      }

    }
  }

  /**
   * TASK-040: 메서드 시그니처 이전의 어노테이션 블록을 역추적하여 추출
   * lazy quantifier 대신 char-by-char 역방향 탐색으로 안전하게 추출
   */
  private extractAnnotationBlockBefore(processed: string, methodStartOffset: number): string {
    // 역방향으로 탐색: 공백, @어노테이션, (괄호내용) 블록을 찾음
    let pos = methodStartOffset - 1;

    // 메서드 시그니처 앞의 공백 건너뛰기
    while (pos >= 0 && (processed[pos] === ' ' || processed[pos] === '\t' || processed[pos] === '\n' || processed[pos] === '\r')) {
      pos--;
    }

    const blockEnd = pos + 1;

    // 어노테이션 블록 역추적: @로 시작하는 패턴이 연속되는 범위를 찾음
    while (pos >= 0) {
      // 닫는 괄호를 만나면 매칭되는 여는 괄호까지 건너뛰기
      if (processed[pos] === ')') {
        let parenCount = 1;
        pos--;
        while (pos >= 0 && parenCount > 0) {
          if (processed[pos] === ')') parenCount++;
          else if (processed[pos] === '(') parenCount--;
          pos--;
        }
        continue;
      }

      // 어노테이션 이름의 일부 (알파벳)
      if (/\w/.test(processed[pos])) {
        // 단어 시작까지 역추적
        while (pos >= 0 && /\w/.test(processed[pos])) {
          pos--;
        }
        // @ 기호 확인
        if (pos >= 0 && processed[pos] === '@') {
          pos--;
          // 다음 어노테이션을 위해 공백 건너뛰기
          while (pos >= 0 && (processed[pos] === ' ' || processed[pos] === '\t' || processed[pos] === '\n' || processed[pos] === '\r')) {
            pos--;
          }
          continue;
        }
        break;
      }

      break;
    }

    const blockStart = pos + 1;
    if (blockStart >= blockEnd) return '';

    return processed.substring(blockStart, blockEnd);
  }

  // ============================================================
  // DI 패턴 파싱
  // ============================================================

  private parseDIPatterns(processed: string, _content: string, lineTable: number[], result: ParsedFile): void {
    // @Autowired 필드 주입
    const fieldDIRegex = /@(?:Autowired|Inject|Resource)\s+(?:private\s+|protected\s+)?(\w+)\s+(\w+)\s*;/g;
    let match: RegExpExecArray | null;

    while ((match = fieldDIRegex.exec(processed)) !== null) {
      const typeName = match[1];
      const fieldName = match[2];
      const line = getLineFromTable(lineTable, match.index);

      result.imports.push({
        source: typeName,
        specifiers: [`@Autowired ${fieldName}`],
        isDefault: false,
        line,
      });
    }


    // @RequiredArgsConstructor: Lombok이 final 필드로 생성자를 자동 생성하는 패턴
    const requiredArgsMatch = processed.match(/@RequiredArgsConstructor(?:\s*\([^)]*\))?\s*(?:@\w+(?:\([^)]*\))?\s*)*(?:public\s+)?(?:class|interface|enum|record)\s+\w+/);
    if (requiredArgsMatch) {
      const classBodyStart = processed.indexOf('{', requiredArgsMatch.index!);
      if (classBodyStart !== -1) {
        const finalFieldRegex = /private\s+final\s+([\w<>]+)\s+(\w+)\s*;/g;
        let fieldMatch: RegExpExecArray | null;

        while ((fieldMatch = finalFieldRegex.exec(processed)) !== null) {
          if (fieldMatch.index > classBodyStart) {
            const typeName = fieldMatch[1];
            if (['int', 'long', 'double', 'float', 'boolean', 'String', 'byte', 'short', 'char', 'Integer', 'Long', 'Double', 'Float', 'Boolean'].includes(typeName)) {
              continue;
            }
            const line = getLineFromTable(lineTable, fieldMatch.index);
            result.imports.push({
              source: typeName,
              specifiers: ['@RequiredArgsConstructor'],
              isDefault: false,
              line,
            });
          }
        }
      }
    }

    // 생성자 주입 패턴 (Spring 권장 방식)
    const constructorRegex = /(?:public\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;
    while ((match = constructorRegex.exec(processed)) !== null) {
      const paramsStr = match[2];
      const line = getLineFromTable(lineTable, match.index);

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


  /**
   * Java record 필드 파싱
   * record Foo(String name, int age) → components에 필드 정보 추가
   */
  private parseRecordFields(
    processed: string,
    lineTable: number[],
    recordName: string,
    filePath: string,
    recordStart: number,
    result: ParsedFile,
  ): void {
    const parenStart = processed.indexOf('(', recordStart);
    if (parenStart === -1) return;

    // 닫는 괄호 찾기 (중첩 안전)
    let count = 1;
    let i = parenStart + 1;
    while (i < processed.length && count > 0) {
      if (processed[i] === '(') count++;
      else if (processed[i] === ')') count--;
      i++;
    }
    const parenEnd = count === 0 ? i - 1 : -1;
    if (parenEnd === -1) return;

    const fieldsStr = processed.substring(parenStart + 1, parenEnd).trim();
    if (!fieldsStr) return;

    const fields: string[] = [];
    const parts = fieldsStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // remove annotations like @NotNull
      const cleaned = trimmed.replace(/@\w+(?:\([^)]*\))?\s*/g, '');
      const fieldMatch = cleaned.match(/([\w<>\[\]?.]+)\s+(\w+)$/);
      if (fieldMatch) {
        fields.push(`${fieldMatch[2]}: ${fieldMatch[1]}`);
      }
    }

    if (fields.length > 0) {
      const existing = result.components.find(c => c.name === recordName);
      if (!existing) {
        result.components.push({
          name: recordName,
          type: 'class-component',
          props: fields,
          filePath,
          line: getLineFromTable(lineTable, recordStart),
        });
      }
    }
  }

  private estimateMethodEndLine(processed: string, lineTable: number[], methodStartOffset: number): number {
    let braceCount = 0;
    let foundFirst = false;
    let i = methodStartOffset;

    while (i < processed.length) {
      if (processed[i] === '{') {
        braceCount++;
        foundFirst = true;
      } else if (processed[i] === '}') {
        braceCount--;
        if (foundFirst && braceCount === 0) {
          return getLineFromTable(lineTable, i);
        }
      }
      i++;
    }

    return getLineFromTable(lineTable, processed.length - 1);
  }


  /**
   * AOP 어노테이션에서 포인트컷 표현식 추출
   * @param annotationBlock - 어노테이션 블록 텍스트
   * @param aopAnnotation - AOP 어노테이션 이름 (Around, Before 등)
   * @returns 포인트컷 표현식 문자열 (없으면 빈 문자열)
   */
  private extractPointcut(annotationBlock: string, aopAnnotation: string): string {
    const annoRegex = new RegExp(`@${aopAnnotation}\\s*\\(\\s*"([^"]*)"\\s*\\)`);
    const match = annotationBlock.match(annoRegex);
    return match ? match[1] : '';
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
