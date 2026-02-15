/**
 * @module utils/retry
 * @description 재시도 유틸리티 - 지수 백오프 재시도 로직
 */

import { logger } from './logger';

/** 재시도 옵션 */
export interface RetryOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 초기 대기 시간 밀리초 (기본: 1000) */
  initialDelayMs?: number;
  /** 백오프 배수 (기본: 2) */
  backoffMultiplier?: number;
  /** 최대 대기 시간 밀리초 (기본: 30000) */
  maxDelayMs?: number;
  /** 재시도할 에러 판별 함수 */
  shouldRetry?: (error: Error) => boolean;
}

/** 기본 재시도 옵션 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  shouldRetry: isRetryableError,
};

/**
 * Rate limit 또는 일시적 에러인지 판별
 *
 * 구조화된 에러 속성(statusCode, status)을 우선 확인하고,
 * 메시지 문자열은 단어 경계(word boundary) 매칭으로 false positive를 방지합니다.
 *
 * @param error - 발생한 에러
 * @returns 재시도 가능 여부
 */
export function isRetryableError(error: Error): boolean {
  // 구조화된 에러 속성 우선 확인
  const statusCode = (error as any).statusCode ?? (error as any).status;
  if (typeof statusCode === 'number') {
    if (statusCode === 429 || (statusCode >= 500 && statusCode <= 504)) {
      return true;
    }
  }

  const message = error.message.toLowerCase();

  // Rate limit 에러
  if (message.includes('rate limit') || message.includes('rate_limit') || /\b429\b/.test(message)) {
    return true;
  }

  // 타임아웃
  if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
    return true;
  }

  // 네트워크 에러
  if (message.includes('econnrefused') || message.includes('econnreset') || message.includes('enotfound')) {
    return true;
  }

  // 서버 에러 (500, 502, 503, 504) - 단어 경계 매칭으로 false positive 방지
  if (/\b500\b/.test(message) || /\b502\b/.test(message) || /\b503\b/.test(message) || /\b504\b/.test(message)) {
    return true;
  }

  return false;
}

/**
 * 지수 백오프 재시도로 비동기 함수 실행
 *
 * 1초 -> 2초 -> 4초 대기 후 재시도 (기본 설정)
 *
 * @param fn - 실행할 비동기 함수
 * @param options - 재시도 옵션
 * @returns 함수 실행 결과
 * @throws 모든 재시도 실패 시 마지막 에러
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('Unknown error');
  let delayMs = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt >= opts.maxRetries) {
        break;
      }

      if (!opts.shouldRetry(lastError)) {
        throw lastError;
      }

      logger.warn(
        `Retry ${attempt + 1}/${opts.maxRetries}: ${lastError.message}. ` +
        `Waiting ${delayMs}ms before next attempt...`
      );

      await sleep(delayMs);
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * 지정된 밀리초만큼 대기
 * @param ms - 대기 시간 (밀리초)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
