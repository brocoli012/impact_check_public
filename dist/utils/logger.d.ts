/**
 * @module utils/logger
 * @description 로깅 유틸리티 - 레벨별 로깅 및 CLI 출력 포맷팅
 */
import { LogLevel } from '../types/common';
/**
 * Logger 클래스 - 애플리케이션 로깅을 담당
 */
export declare class Logger {
    private level;
    /**
     * Logger 인스턴스 생성
     * @param level - 최소 로그 레벨
     */
    constructor(level?: LogLevel);
    /**
     * 로그 레벨을 설정
     * @param level - 새 로그 레벨
     */
    setLevel(level: LogLevel): void;
    /**
     * 현재 로그 레벨을 반환
     * @returns 현재 로그 레벨
     */
    getLevel(): LogLevel;
    /**
     * 디버그 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    debug(message: string, ...args: unknown[]): void;
    /**
     * 정보 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    info(message: string, ...args: unknown[]): void;
    /**
     * 경고 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    warn(message: string, ...args: unknown[]): void;
    /**
     * 에러 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    error(message: string, ...args: unknown[]): void;
    /**
     * 치명적 에러 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    fatal(message: string, ...args: unknown[]): void;
    /**
     * 성공 메시지 출력 (CLI 전용)
     * @param message - 성공 메시지
     */
    success(message: string): void;
    /**
     * 구분선 출력 (CLI 전용)
     */
    separator(): void;
    /**
     * 헤더 출력 (CLI 전용)
     * @param title - 헤더 제목
     */
    header(title: string): void;
    /**
     * 내부 로그 출력
     * @param level - 로그 레벨
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    private log;
}
/** 전역 Logger 인스턴스 */
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map