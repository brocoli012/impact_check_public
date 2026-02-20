/**
 * @module core/indexing/parsers/java-ast-parser
 * @description Java AST 파서 - tree-sitter 기반 Java 소스코드 분석 (Phase 2)
 *
 * tree-sitter-java의 AST를 순회하여 Phase 1 Regex 파서 대비
 * 중첩 클래스, 멀티라인 어노테이션, 제네릭, 람다 등을 정확히 파싱한다.
 */
import { BaseParser } from './base-parser';
import { ParsedFile } from '../types';
/**
 * JavaAstParser - tree-sitter 기반 Java AST 파서 (Phase 2)
 *
 * Phase 1 대비 개선:
 *   - 중첩 클래스 / inner class 완전 지원
 *   - 멀티라인 어노테이션 정확 파싱
 *   - 제네릭 타입 완전 해석
 *   - 람다/익명 클래스 내부 탐색
 *   - @Bean 메서드 DI 감지: 향후 지원 예정
 */
export declare class JavaAstParser extends BaseParser {
    readonly name = "java-ast";
    readonly supportedExtensions: string[];
    parse(filePath: string, content: string): Promise<ParsedFile>;
    private extractPackage;
    private extractImports;
    private traverseNode;
    private processClassDeclaration;
    private processMethod;
    private processConstructor;
    private processField;
    private extractAnnotations;
    private extractModifiers;
    private extractMethodParams;
    private extractRequestMappingPath;
    private findChildByFieldName;
    private extractComments;
    private walkTree;
}
//# sourceMappingURL=java-ast-parser.d.ts.map