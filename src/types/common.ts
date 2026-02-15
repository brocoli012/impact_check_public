/**
 * @module types/common
 * @description 공통 타입 정의 - 프로젝트 전반에서 사용되는 기본 타입
 */

/** 결과 코드 - 명령어 실행 결과를 나타내는 열거형 */
export enum ResultCode {
  /** 성공 */
  SUCCESS = 'SUCCESS',
  /** 실패 */
  FAILURE = 'FAILURE',
  /** 부분 성공 */
  PARTIAL = 'PARTIAL',
  /** 취소됨 */
  CANCELLED = 'CANCELLED',
  /** 설정 필요 */
  NEEDS_CONFIG = 'NEEDS_CONFIG',
  /** 인덱스 필요 */
  NEEDS_INDEX = 'NEEDS_INDEX',
}

/** 로그 레벨 */
export enum LogLevel {
  /** 디버그 */
  DEBUG = 'debug',
  /** 정보 */
  INFO = 'info',
  /** 경고 */
  WARN = 'warn',
  /** 에러 */
  ERROR = 'error',
  /** 치명적 에러 */
  FATAL = 'fatal',
}

/** 명령어 실행 결과 */
export interface CommandResult {
  /** 결과 코드 */
  code: ResultCode;
  /** 결과 메시지 */
  message: string;
  /** 추가 데이터 */
  data?: unknown;
}

/** 명령어 인터페이스 - 모든 커맨드 핸들러가 구현해야 하는 인터페이스 */
export interface Command {
  /** 명령어 이름 */
  readonly name: string;
  /** 명령어 설명 */
  readonly description: string;
  /** 명령어 실행 */
  execute(): Promise<CommandResult>;
}

/** 페이지네이션 옵션 */
export interface PaginationOptions {
  /** 페이지 번호 (1부터 시작) */
  page: number;
  /** 페이지당 항목 수 */
  limit: number;
}

/** 페이지네이션 결과 */
export interface PaginatedResult<T> {
  /** 데이터 항목 목록 */
  items: T[];
  /** 전체 항목 수 */
  total: number;
  /** 현재 페이지 */
  page: number;
  /** 페이지당 항목 수 */
  limit: number;
  /** 전체 페이지 수 */
  totalPages: number;
}

/** ISO 8601 날짜 문자열 타입 */
export type ISODateString = string;

/** 파일 경로 타입 */
export type FilePath = string;

/** 고유 식별자 타입 */
export type UniqueId = string;

/** 키-값 맵 타입 */
export type KeyValueMap<T = string> = Record<string, T>;
