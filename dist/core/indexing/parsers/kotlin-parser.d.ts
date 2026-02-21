/**
 * @module core/indexing/parsers/kotlin-parser
 * @description Kotlin 파서 - Regex 기반 Kotlin 소스코드 분석 (Phase 1)
 *
 * Spring Boot 프로젝트의 Kotlin 파일을 정규식으로 파싱하여
 * import, export, 함수, 컴포넌트(Spring bean), 라우트 정의,
 * 주석 등 구조화된 정보를 추출한다.
 *
 * Kotlin 특화:
 *   - suspend fun → isAsync: true
 *   - data class → 필드 자동 추출
 *   - top-level function 지원
 *   - primary constructor DI
 *   - companion object 내부 메서드
 */
import { BaseParser } from './base-parser';
import { ParsedFile } from '../types';
/**
 * KotlinParser - Regex 기반 Kotlin 소스코드 분석기
 *
 * 지원 범위:
 *   - import 문 (as alias 포함)
 *   - class/object/interface 선언 → export
 *   - fun 정의 (suspend, top-level 포함) → function
 *   - Spring @RestController/@Service/@Repository → component
 *   - @GetMapping/@PostMapping 등 → routeDefinition
 *   - Primary constructor DI / @Autowired property → import (DI)
 *   - data class → model 힌트
 *   - 주석 추출 (line/block, 정책 주석 포함)
 */
export declare class KotlinParser extends BaseParser {
    readonly name = "kotlin";
    readonly supportedExtensions: string[];
    parse(filePath: string, content: string): Promise<ParsedFile>;
    private parseImports;
    private parsePackage;
    private parseClassAnnotations;
    private parseClassDeclaration;
    private parseFunctions;
    /**
     * TASK-040: fun 시그니처 이전의 어노테이션 블록을 역추적하여 추출
     * lazy quantifier 대신 char-by-char 역방향 탐색으로 안전하게 추출
     */
    private extractAnnotationBlockBefore;
    private parsePrimaryConstructorDI;
    private parsePropertyInjection;
    private parseDataClassFields;
    private parseEntityModels;
    private parseEventPatterns;
    private findEnclosingFunction;
    private extractComments;
    private parseKotlinParams;
    private estimateMethodEndLine;
    private extractAnnotationText;
}
//# sourceMappingURL=kotlin-parser.d.ts.map