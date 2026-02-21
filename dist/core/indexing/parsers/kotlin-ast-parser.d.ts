/**
 * @module core/indexing/parsers/kotlin-ast-parser
 * @description Kotlin AST 파서 - tree-sitter 기반 Kotlin 소스코드 분석 (Phase 2)
 *
 * tree-sitter-kotlin의 AST를 순회하여 Phase 1 Regex 파서 대비
 * data class, sealed class, companion object, DSL 패턴 등을 정확히 파싱한다.
 */
import { BaseParser } from './base-parser';
import { ParsedFile } from '../types';
/**
 * KotlinAstParser - tree-sitter 기반 Kotlin AST 파서 (Phase 2)
 *
 * Phase 1 대비 개선:
 *   - data class / sealed class / object / companion object 완전 지원
 *   - 멀티라인 어노테이션 정확 파싱
 *   - 제네릭 타입 완전 해석
 *   - expression body (=) 함수 지원
 *   - Kotlin DSL 부분 인식
 *   - suspend fun 정확 파싱
 */
export declare class KotlinAstParser extends BaseParser {
    readonly name = "kotlin-ast";
    readonly supportedExtensions: string[];
    parse(filePath: string, content: string): Promise<ParsedFile>;
    private extractImports;
    private traverseNode;
    private processClassDeclaration;
    private processObjectDeclaration;
    private processCompanionObject;
    private processFunction;
    private processPrimaryConstructor;
    private processDataClassFields;
    private parseEntityModel;
    private processProperty;
    private extractComments;
    private extractAnnotations;
    private extractModifiers;
    private extractFunctionParams;
    private extractRequestMappingPath;
    private walkTree;
}
//# sourceMappingURL=kotlin-ast-parser.d.ts.map