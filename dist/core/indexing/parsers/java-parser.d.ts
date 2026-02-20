/**
 * @module core/indexing/parsers/java-parser
 * @description Java 파서 - Regex 기반 Java 소스코드 분석 (Phase 1)
 *
 * Spring Boot 프로젝트의 Java 파일을 정규식으로 파싱하여
 * import, export(public class/method), 함수, 컴포넌트(Spring bean),
 * API 호출, 라우트 정의, 주석 등 구조화된 정보를 추출한다.
 */
import { BaseParser } from './base-parser';
import { ParsedFile } from '../types';
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
export declare class JavaParser extends BaseParser {
    readonly name = "java";
    readonly supportedExtensions: string[];
    parse(filePath: string, content: string): Promise<ParsedFile>;
    private parseImports;
    private parsePackage;
    private parseClassAnnotations;
    private parseClassDeclaration;
    private parseMethods;
    private parseDIPatterns;
    private extractComments;
    private parseMethodParams;
    /**
     * Java record 필드 파싱
     * record Foo(String name, int age) → components에 필드 정보 추가
     */
    private parseRecordFields;
    private estimateMethodEndLine;
    /**
     * AOP 어노테이션에서 포인트컷 표현식 추출
     * @param annotationBlock - 어노테이션 블록 텍스트
     * @param aopAnnotation - AOP 어노테이션 이름 (Around, Before 등)
     * @returns 포인트컷 표현식 문자열 (없으면 빈 문자열)
     */
    private extractPointcut;
    private extractAnnotationText;
}
//# sourceMappingURL=java-parser.d.ts.map