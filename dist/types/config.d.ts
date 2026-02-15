/**
 * @module types/config
 * @description 설정 타입 정의 - 애플리케이션 설정 및 API 키 관리
 */
/** 애플리케이션 전체 설정 (config.json 스키마) */
export interface AppConfig {
    /** 설정 버전 */
    version: number;
    /** LLM 프로바이더 설정 */
    llm: {
        /** 기본 프로바이더 */
        defaultProvider: string;
        /** 프로바이더별 설정 */
        providers: Record<string, LLMProviderConfig>;
        /** 용도별 라우팅 테이블 */
        routing: Record<string, string>;
    };
    /** 일반 설정 */
    general: {
        /** 자동 인덱스 업데이트 여부 */
        autoReindex: boolean;
        /** 시각화 웹 서버 포트 */
        webPort: number;
        /** 로그 레벨 */
        logLevel: string;
        /** LLM 데이터 전송 동의 여부 */
        llmDataConsent: boolean;
    };
}
/** LLM 프로바이더 설정 */
export interface LLMProviderConfig {
    /** 프로바이더 이름 */
    name: string;
    /** API 키 (암호화) */
    apiKey: string;
    /** 기본 모델 */
    defaultModel: string;
    /** 최대 토큰 */
    maxTokens: number;
    /** 온도 (temperature) */
    temperature: number;
    /** 활성화 여부 */
    enabled: boolean;
}
/** 시스템 담당자 설정 (owners.json 스키마) */
export interface OwnersConfig {
    /** 시스템별 담당자 목록 */
    systems: SystemOwner[];
}
/** 시스템 담당자 */
export interface SystemOwner {
    /** 시스템명 */
    systemName: string;
    /** 시스템 ID */
    systemId: string;
    /** 담당 팀 */
    team: string;
    /** 담당자 정보 */
    owner: {
        /** 담당자 이름 */
        name: string;
        /** 담당자 이메일 */
        email: string;
        /** 슬랙 채널 */
        slackChannel?: string;
    };
    /** 담당 범위 */
    scope: string;
    /** 관련 코드 경로 */
    relatedPaths: string[];
    /** 마지막 업데이트 시각 */
    updatedAt: string;
}
/** 기본 애플리케이션 설정 */
export declare const DEFAULT_CONFIG: AppConfig;
//# sourceMappingURL=config.d.ts.map