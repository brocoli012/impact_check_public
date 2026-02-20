/**
 * @module core/indexing/indexer
 * @description 인덱서 메인 - 전체 인덱싱 파이프라인 실행 및 인덱스 관리
 */
import { CodeIndex, ChangedFileSet } from '../../types/index';
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
     * 파일 목록을 파싱 (TASK-063: parseFilesStreaming 래퍼)
     *
     * 내부적으로 parseFilesStreaming()에 위임하여 결과를 배열로 수집한다.
     * CircuitBreaker, MemoryGuard, AST→Regex 폴백 등 모든 파싱 로직은
     * parseFilesStreaming() 단일 지점에서 관리된다.
     */
    private parseFiles;
    /**
     * TASK-039: 스트리밍 파싱 - 각 파일 파싱 직후 visitor 콜백 호출
     * ParsedFile 참조를 caller가 필요한 만큼만 유지할 수 있도록 함
     *
     * @param projectPath - 프로젝트 루트 경로
     * @param files - 파일 목록
     * @param contentCache - TASK-038 콘텐츠 캐시
     * @param visitor - 각 파싱된 파일에 대해 호출되는 콜백
     * @returns 파싱된 파일 수
     */
    private parseFilesStreaming;
    /**
     * 메모리 할당 없이 라인 수를 카운트
     */
    private countLines;
    /**
     * Parser.parse() 호출을 timeout으로 래핑
     */
    private parseWithTimeout;
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