/**
 * @module core/indexing/parsers/tree-sitter-loader
 * @description tree-sitter 동적 로딩 유틸리티
 *
 * tree-sitter와 언어 grammar를 동적으로 로드하고 캐싱한다.
 * 로드 실패 시 null을 반환하여 호출측에서 Phase 1 Regex 파서로 폴백할 수 있도록 한다.
 */
/** tree-sitter Parser 타입 (동적 로딩이므로 any 사용) */
type TreeSitterParser = any;
type TreeSitterTree = any;
export type TreeSitterNode = any;
/**
 * tree-sitter 캐시 리셋 (테스트용)
 * 전체 테스트 스위트에서 다른 테스트의 모듈 모킹 영향을 피하기 위해 사용
 */
export declare function resetTreeSitterCache(): void;
/**
 * Java 파서 인스턴스를 가져오기 (캐싱)
 * @returns tree-sitter Java Parser 또는 null
 */
export declare function getJavaParser(): Promise<TreeSitterParser | null>;
/**
 * Kotlin 파서 인스턴스를 가져오기 (캐싱)
 * @returns tree-sitter Kotlin Parser 또는 null
 */
export declare function getKotlinParser(): Promise<TreeSitterParser | null>;
/**
 * tree-sitter가 사용 가능한지 동기적으로 확인
 * constructor에서 호출 가능하도록 동기 함수로 제공.
 * require()는 동기 호출이므로 안전하다.
 * @returns true이면 사용 가능
 */
export declare function isTreeSitterAvailable(): boolean;
/**
 * Java 소스 코드를 파싱하여 AST 트리 반환
 * @param content - Java 소스 코드
 * @returns AST 트리 또는 null
 */
export declare function parseJava(content: string): Promise<TreeSitterTree | null>;
/**
 * Kotlin 소스 코드를 파싱하여 AST 트리 반환
 * @param content - Kotlin 소스 코드
 * @returns AST 트리 또는 null
 */
export declare function parseKotlin(content: string): Promise<TreeSitterTree | null>;
export {};
//# sourceMappingURL=tree-sitter-loader.d.ts.map