/**
 * @module config/config-manager
 * @description 설정 관리자 - 설정 로드/저장, 활성 프로젝트 관리
 */
import { AppConfig } from '../types/config';
/**
 * ConfigManager 클래스 - 애플리케이션 설정 관리
 *
 * 기능:
 *   - .impact/config.json 로드/저장
 *   - 활성 프로젝트 관리
 */
export declare class ConfigManager {
    private config;
    private readonly configDir;
    private readonly configPath;
    /**
     * ConfigManager 인스턴스 생성
     * @param basePath - .impact 디렉토리의 기본 경로 (기본값: HOME)
     */
    constructor(basePath?: string);
    /**
     * 설정 파일을 로드
     * 파일이 없으면 기본 설정 사용
     */
    load(): Promise<void>;
    /**
     * 현재 설정을 파일로 저장
     */
    save(): Promise<void>;
    /**
     * 현재 설정을 반환
     * @returns 현재 AppConfig
     */
    getConfig(): AppConfig;
    /**
     * 활성 프로젝트 ID를 조회
     * @returns 활성 프로젝트 ID (없으면 null)
     */
    getActiveProject(): string | null;
    /**
     * 활성 프로젝트 ID를 설정
     * @param projectId - 프로젝트 ID
     */
    setActiveProject(projectId: string): void;
    /**
     * 설정을 초기화
     */
    reset(): void;
    /**
     * 정책 문서 저장 디렉토리 경로를 반환한다.
     * ~/.impact/docs/{projectId}
     */
    static getDocsDir(projectId: string): string;
}
//# sourceMappingURL=config-manager.d.ts.map