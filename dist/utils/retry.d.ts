/**
 * @module utils/retry
 * @description 재시도 유틸리티 - 지수 백오프 재시도 로직
 */
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
/**
 * Rate limit 또는 일시적 에러인지 판별
 *
 * 구조화된 에러 속성(statusCode, status)을 우선 확인하고,
 * 메시지 문자열은 단어 경계(word boundary) 매칭으로 false positive를 방지합니다.
 *
 * @param error - 발생한 에러
 * @returns 재시도 가능 여부
 */
export declare function isRetryableError(error: Error): boolean;
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
export declare function retryWithBackoff<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map