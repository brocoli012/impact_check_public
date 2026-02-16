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
 *   6. JSON 직렬화 -> .impact/projects/{id}/index/ 저장
 */
export declare class Indexer {
    private readonly scanner;
    private readonly parsers;
    private readonly graphBuilder;
    private readonly policyExtractor;
    constructor();
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
     */
    private parseFiles;
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
     * Git 정보 가져오기
     */
    private getGitInfo;
    /**
     * 패키지 매니저 감지
     */
    private detectPackageManager;
}
//# sourceMappingURL=indexer.d.ts.map