/**
 * @module core/indexing/indexer
 * @description 인덱서 메인 - 전체 인덱싱 파이프라인 실행 및 인덱스 관리
 */
import { CodeIndex, ChangedFileSet } from '../../types/index';
/**
 * Indexer - 전체 인덱싱 파이프라인 실행 및 관리
 *
 * 파이프라인:
 *   1. FileScanner.scan() -> 파일 목록
 *   2. 각 파일에 대해 Parser.parse() -> ParsedFile[]
 *   3. PolicyExtractor -> 정책 추출
 *   4. DependencyGraphBuilder.build() -> 의존성 그래프
 *   5. 결과 조합 -> CodeIndex
 *   6. (optional) 보강 주석 생성 (annotationsEnabled일 때만)
 *   7. JSON 직렬화 -> .impact/projects/{id}/index/ 저장
 */
export declare class Indexer {
    private readonly scanner;
    private readonly parsers;
    private readonly regexFallbackParsers;
    private readonly graphBuilder;
    private readonly policyExtractor;
    private readonly annotationsEnabled;
    constructor(options?: {
        annotationsEnabled?: boolean;
        parserMode?: 'ast' | 'regex' | 'auto';
    });
    /**
     * JVM 파서 초기화 전략
     *
     * - 'ast': tree-sitter AST 파서 강제 (실패 시 에러)
     * - 'regex': Phase 1 Regex 파서 강제
     * - 'auto' (기본): tree-sitter 가용 시 AST 파서, 불가 시 Regex 폴백
     *
     * 환경 변수 PARSER_MODE 로도 설정 가능 (코드 파라미터 우선)
     */
    private initParsers;
    /**
     * 전체 인덱싱 파이프라인 실행
     * @param projectPath - 프로젝트 루트 경로
     * @returns 전체 코드 인덱스
     */
    fullIndex(projectPath: string): Promise<CodeIndex>;
    /**
     * 증분 업데이트 - Git diff 기반으로 변경된 파일만 재파싱
     * @param projectPath - 프로젝트 루트 경로
     * @param projectId - 프로젝트 ID (인덱스 로드/저장용)
     * @param basePath - 기본 경로 (인덱스 로드/저장용)
     * @returns 업데이트된 코드 인덱스
     */
    incrementalUpdate(projectPath: string, projectId?: string, basePath?: string): Promise<CodeIndex>;
    /**
     * 인덱스가 최신인지 확인
     * @param projectPath - 프로젝트 루트 경로
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     * @returns true이면 stale (업데이트 필요)
     */
    isIndexStale(projectPath: string, projectId?: string, basePath?: string): Promise<boolean>;
    /**
     * 인덱스 저장
     * @param index - 코드 인덱스
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     */
    saveIndex(index: CodeIndex, projectId: string, basePath?: string): Promise<void>;
    /**
     * 인덱스 로드
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     * @returns 코드 인덱스 (없으면 null)
     */
    loadIndex(projectId: string, basePath?: string): Promise<CodeIndex | null>;
    /**
     * 파일 목록을 파싱
     *
     * AST 파서가 빈 결과(imports=0, exports=0, functions=0)를 반환하면,
     * regexFallbackParsers로 해당 파일을 재시도한다 (per-file fallback).
     */
    private parseFiles;
    /**
     * Parser.parse() 호출을 timeout으로 래핑
     */
    private parseWithTimeout;
    /**
     * 배열을 청크 단위로 분할
     */
    private chunkArray;
    /**
     * ParsedFile이 빈 결과인지 확인 (imports=0, exports=0, functions=0)
     */
    private isEmptyParseResult;
    /**
     * regexFallbackParsers에서 해당 파일에 적합한 파서 찾기
     */
    private findFallbackParser;
    /**
     * 파일에 적합한 파서 찾기
     */
    private findParser;
    /**
     * 컴포넌트 정보 추출
     */
    private extractComponents;
    /**
     * API 엔드포인트 정보 추출
     */
    private extractApiEndpoints;
    /**
     * 화면 정보 추출
     */
    private extractScreens;
    /**
     * Git diff 또는 hash 비교를 통해 변경된 파일 목록을 반환
     * @param projectPath 프로젝트 루트 경로
     * @param lastCommit 이전 인덱싱 시점의 Git commit hash
     * @returns ChangedFileSet
     */
    getChangedFiles(projectPath: string, lastCommit: string): Promise<ChangedFileSet>;
    /**
     * 해시 비교 방식으로 변경된 파일 감지 (Git 폴백)
     * @param projectPath 프로젝트 루트 경로 (resolved)
     * @returns ChangedFileSet
     */
    private getChangedFilesByHash;
    /**
     * 보강 주석 생성 (optional step)
     *
     * ParsedFile 목록을 받아 AnnotationGenerator로 보강 주석을 생성하고,
     * AnnotationManager로 저장한다.
     *
     * @param projectPath - 프로젝트 루트 경로
     * @param parsedFiles - 파싱된 파일 목록
     * @param projectId - 프로젝트 ID
     */
    private generateAnnotations;
    /**
     * Git 정보 가져오기
     */
    private getGitInfo;
    /**
     * 패키지 매니저 감지
     */
    private detectPackageManager;
}
//# sourceMappingURL=indexer.d.ts.map