/**
 * @module core/indexing/parsers/tree-sitter-loader
 * @description tree-sitter 동적 로딩 유틸리티
 *
 * tree-sitter와 언어 grammar를 동적으로 로드하고 캐싱한다.
 * 로드 실패 시 null을 반환하여 호출측에서 Phase 1 Regex 파서로 폴백할 수 있도록 한다.
 *
 * Jest 모듈 격리 대응:
 * Jest의 node 테스트 환경은 각 테스트 파일마다 독립된 vm context를 생성하며,
 * global/process/require.cache가 파일 간 공유되지 않는다.
 * 그러나 Module._cache는 실제 Node.js 모듈 캐시이며 Jest 격리를 받지 않는다.
 *
 * tree-sitter C++ native addon은 같은 프로세스에서 require.cache 리셋 후
 * 재require되면 기존 Parser 인스턴스가 무효화된다(rootNode → undefined).
 *
 * 해결: Module._load()로 tree-sitter를 로드하여 Module._cache에 저장하고,
 * 파서 인스턴스도 Module._cache 내 커스텀 키에 보관하여 Jest 격리를 우회한다.
 */
/** tree-sitter Parser 타입 (동적 로딩이므로 any 사용) */
type TreeSitterParser = any;
type TreeSitterTree = any;
export type TreeSitterNode = any;
/**
 * tree-sitter 캐시 리셋 (테스트용)
 * global 캐시도 함께 리셋한다.
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