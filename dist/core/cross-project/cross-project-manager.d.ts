/**
 * @module core/cross-project/cross-project-manager
 * @description 크로스 프로젝트 매니저 - 프로젝트 간 의존성 관리
 */
import { CrossProjectConfig, ProjectLink, ProjectGroup, LinkType, DetectResult } from './types';
import { Indexer } from '../indexing/indexer';
/**
 * CrossProjectManager - 프로젝트 간 의존성 관리
 *
 * 기본 경로: ~/.impact/cross-project.json
 * 글로벌 설정 파일로, 모든 프로젝트의 크로스 프로젝트 의존성을 관리합니다.
 */
export declare class CrossProjectManager {
    private readonly configPath;
    /**
     * CrossProjectManager 생성
     * @param basePath - 기본 경로 (기본값: ~/.impact/)
     */
    constructor(basePath?: string);
    /**
     * 설정 파일 로드 (없으면 빈 설정 반환)
     * @returns 크로스 프로젝트 설정
     */
    loadConfig(): Promise<CrossProjectConfig>;
    /**
     * 설정 파일 저장
     * @param config - 저장할 크로스 프로젝트 설정
     */
    saveConfig(config: CrossProjectConfig): Promise<void>;
    /**
     * 프로젝트 간 의존성 등록 (파일 잠금으로 동시 접근 보호)
     * @param source - 소스 프로젝트 ID
     * @param target - 대상 프로젝트 ID
     * @param type - 의존성 유형
     * @param apis - 관련 API 경로 목록
     * @returns 생성된 프로젝트 링크
     */
    link(source: string, target: string, type: LinkType, apis?: string[]): Promise<ProjectLink>;
    /**
     * 프로젝트 간 의존성 해제 (파일 잠금으로 동시 접근 보호)
     * 양방향 삭제: A->B, B->A 모두 확인하여 삭제
     * @param source - 소스 프로젝트 ID
     * @param target - 대상 프로젝트 ID
     * @returns 삭제 성공 여부
     */
    unlink(source: string, target: string): Promise<boolean>;
    /**
     * 의존성 조회 (특정 프로젝트 또는 전체)
     * @param projectId - 프로젝트 ID (생략 시 전체 조회)
     * @returns 프로젝트 링크 목록
     */
    getLinks(projectId?: string): Promise<ProjectLink[]>;
    /**
     * 특정 링크 조회
     * @param source - 소스 프로젝트 ID
     * @param target - 대상 프로젝트 ID
     * @returns 프로젝트 링크 또는 null
     */
    getLink(source: string, target: string): Promise<ProjectLink | null>;
    /**
     * 그룹 추가 (파일 잠금으로 동시 접근 보호)
     * @param name - 그룹 이름
     * @param projectIds - 포함할 프로젝트 ID 목록
     * @returns 생성된 프로젝트 그룹
     */
    addGroup(name: string, projectIds: string[]): Promise<ProjectGroup>;
    /**
     * 그룹 조회
     * @param name - 그룹 이름
     * @returns 프로젝트 그룹 또는 null
     */
    getGroup(name: string): Promise<ProjectGroup | null>;
    /**
     * 그룹 목록 조회
     * @returns 프로젝트 그룹 목록
     */
    getGroups(): Promise<ProjectGroup[]>;
    /**
     * 그룹 삭제 (파일 잠금으로 동시 접근 보호)
     * @param name - 삭제할 그룹 이름
     * @returns 삭제 성공 여부
     */
    removeGroup(name: string): Promise<boolean>;
    /**
     * API 경로 매칭 기반 자동 의존성 감지
     *
     * 각 프로젝트의 인덱스를 로드하고, 프로젝트 간 API 경로 매칭을 통해
     * 자동으로 의존성 링크를 탐지합니다.
     *
     * @param indexer - 인덱서 인스턴스 (loadIndex 사용)
     * @param projectIds - 감지 대상 프로젝트 ID 목록
     * @returns 감지된 ProjectLink 배열 (autoDetected: true, 저장하지 않음)
     */
    detectLinks(indexer: Indexer, projectIds: string[]): Promise<ProjectLink[]>;
    /**
     * API 경로 매칭 기반 자동 의존성 감지 + 저장 (원자적)
     *
     * detectLinks()를 호출한 후, 결과를 cross-project.json에 저장합니다.
     * - 기존 수동 링크(autoDetected: false)는 보존
     * - 기존 자동 링크(autoDetected: true)는 최신 결과로 교체
     * - 수동 링크와 동일 source-target 조합이면 건너뜀
     *
     * @param indexer - 인덱서 인스턴스
     * @param projectIds - 감지 대상 프로젝트 ID 목록
     * @returns DetectResult (감지/저장 통계)
     */
    detectAndSave(indexer: Indexer, projectIds: string[]): Promise<DetectResult>;
    /**
     * 두 프로젝트의 API 경로 매칭
     * - 정확 매칭 (exact match) 우선
     * - 패턴 매칭 (path parameter 치환) 2차
     *
     * @param providerApis - 제공자 프로젝트의 API 목록
     * @param consumerApis - 소비자 프로젝트의 API 목록
     * @returns 매칭된 API 경로 목록
     */
    private matchApiPaths;
    /**
     * 두 경로가 패턴 매칭으로 동일한지 확인
     * 예: `/api/users/:id` ↔ `/api/users/123`
     *
     * @param pathA - 경로 A (path parameter 포함 가능)
     * @param pathB - 경로 B (path parameter 포함 가능)
     * @returns 매칭 여부
     */
    private matchPathPattern;
}
//# sourceMappingURL=cross-project-manager.d.ts.map