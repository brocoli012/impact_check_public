/**
 * @module utils/logger
 * @description 로깅 유틸리티 - 레벨별 로깅 및 CLI 출력 포맷팅
 */

import { LogLevel } from '../types/common';

/** 로그 레벨 우선순위 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
};

/** ANSI 색상 코드 */
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
} as const;

/** 로그 레벨별 색상 매핑 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.gray,
  [LogLevel.INFO]: COLORS.blue,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.FATAL]: COLORS.red + COLORS.bold,
};

/**
 * Logger 클래스 - 애플리케이션 로깅을 담당
 */
export class Logger {
  private level: LogLevel;

  /**
   * Logger 인스턴스 생성
   * @param level - 최소 로그 레벨
   */
  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * 로그 레벨을 설정
   * @param level - 새 로그 레벨
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 현재 로그 레벨을 반환
   * @returns 현재 로그 레벨
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 디버그 메시지 출력
   * @param message - 로그 메시지
   * @param args - 추가 인자
   */
  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * 정보 메시지 출력
   * @param message - 로그 메시지
   * @param args - 추가 인자
   */
  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * 경고 메시지 출력
   * @param message - 로그 메시지
   * @param args - 추가 인자
   */
  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * 에러 메시지 출력
   * @param message - 로그 메시지
   * @param args - 추가 인자
   */
  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * 치명적 에러 메시지 출력
   * @param message - 로그 메시지
   * @param args - 추가 인자
   */
  fatal(message: string, ...args: unknown[]): void {
    this.log(LogLevel.FATAL, message, ...args);
  }

  /**
   * 성공 메시지 출력 (CLI 전용)
   * @param message - 성공 메시지
   */
  success(message: string): void {
    console.log(`${COLORS.green}[OK]${COLORS.reset} ${message}`);
  }

  /**
   * 구분선 출력 (CLI 전용)
   */
  separator(): void {
    console.log(`${COLORS.gray}${'─'.repeat(60)}${COLORS.reset}`);
  }

  /**
   * 헤더 출력 (CLI 전용)
   * @param title - 헤더 제목
   */
  header(title: string): void {
    this.separator();
    console.log(`${COLORS.bold}${COLORS.cyan} ${title}${COLORS.reset}`);
    this.separator();
  }

  /**
   * 내부 로그 출력
   * @param level - 로그 레벨
   * @param message - 로그 메시지
   * @param args - 추가 인자
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const levelTag = level.toUpperCase().padEnd(5);
    const prefix = `${COLORS.gray}${timestamp}${COLORS.reset} ${color}[${levelTag}]${COLORS.reset}`;

    if (args.length > 0) {
      console.log(`${prefix} ${message}`, ...args);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

/** 전역 Logger 인스턴스 */
export const logger = new Logger(LogLevel.INFO);
