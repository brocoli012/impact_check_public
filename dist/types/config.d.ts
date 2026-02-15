/**
 * @module types/config
 * @description 설정 타입 정의 - 애플리케이션 설정
 */
/** 애플리케이션 전체 설정 (config.json 스키마) */
export interface AppConfig {
    /** 설정 버전 */
    version: number;
    /** 일반 설정 */
    general: {
        /** 자동 인덱스 업데이트 여부 */
        autoReindex: boolean;
        /** 시각화 웹 서버 포트 */
        webPort: number;
        /** 로그 레벨 */
        logLevel: string;
    };
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