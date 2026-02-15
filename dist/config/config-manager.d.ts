/**
 * @module config/config-manager
 * @description 설정 관리자 - API 키 암호화/복호화, 설정 로드/저장
 */
import { AppConfig } from '../types/config';
/**
 * ConfigManager 클래스 - 애플리케이션 설정 관리
 *
 * 기능:
 *   - .impact/config.json 로드/저장
 *   - API 키 AES-256-GCM 암호화/복호화
 *   - 머신별 고유 암호화 키 생성
 *   - 활성 프로젝트 관리
 */
export declare class ConfigManager {
    private config;
    private readonly configDir;
    private readonly configPath;
    private encryptionKey;
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
     * 프로바이더의 API 키를 조회 (복호화)
     * @param provider - 프로바이더 이름
     * @returns 복호화된 API 키 (없으면 null)
     */
    getApiKey(provider: string): string | null;
    /**
     * 프로바이더의 API 키를 설정 (암호화)
     * @param provider - 프로바이더 이름
     * @param apiKey - 평문 API 키
     */
    setApiKey(provider: string, apiKey: string): void;
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
     * LLM 데이터 전송 동의 여부를 설정
     * @param consent - 동의 여부
     */
    setLLMDataConsent(consent: boolean): void;
    /**
     * 설정을 초기화 (API 키 분실 시)
     */
    reset(): void;
    /**
     * 머신별 고유 암호화 키를 생성/조회
     * MVP에서는 머신 정보 기반으로 결정적 키 생성
     * @returns 암호화 키 Buffer
     */
    private getEncryptionKey;
    /**
     * 문자열을 AES-256-GCM으로 암호화
     * @param plaintext - 평문
     * @returns 암호화된 문자열 (iv:authTag:ciphertext, hex)
     */
    private encrypt;
    /**
     * AES-256-GCM으로 암호화된 문자열을 복호화
     * @param ciphertext - 암호화된 문자열 (iv:authTag:ciphertext, hex)
     * @returns 복호화된 평문
     */
    private decrypt;
    /**
     * 프로바이더별 기본 설정 생성
     * @param provider - 프로바이더 이름
     * @returns 기본 LLMProviderConfig
     */
    private createDefaultProviderConfig;
}
//# sourceMappingURL=config-manager.d.ts.map