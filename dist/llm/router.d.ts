/**
 * @module llm/router
 * @description LLM 라우터 - 용도별 최적 프로바이더 자동 선택
 */
import { LLMProvider, LLMTask, LLMResponse, Message, LLMOptions, ProviderInfo } from '../types/llm';
import { RetryOptions } from '../utils/retry';
/** 프로바이더를 찾을 수 없는 에러 */
export declare class ProviderNotFoundError extends Error {
    constructor(name: string);
}
/** 프로바이더가 설정되지 않은 에러 */
export declare class NoProviderConfiguredError extends Error {
    constructor();
}
/**
 * ProviderRegistry - LLM 프로바이더 등록/관리
 */
export declare class ProviderRegistry {
    private providers;
    /**
     * 프로바이더 등록
     * @param provider - LLMProvider 인스턴스
     */
    register(provider: LLMProvider): void;
    /**
     * 프로바이더 조회
     * @param name - 프로바이더 이름
     * @returns LLMProvider 인스턴스
     * @throws {ProviderNotFoundError}
     */
    get(name: string): LLMProvider;
    /**
     * 프로바이더 존재 여부 확인
     * @param name - 프로바이더 이름
     * @returns 존재 여부
     */
    has(name: string): boolean;
    /**
     * 등록된 프로바이더 목록 조회
     * @returns 프로바이더 정보 배열
     */
    list(): ProviderInfo[];
}
/**
 * LLMRouter - 용도별 프로바이더 자동 선택
 */
export declare class LLMRouter {
    private readonly registry;
    /** 기본 라우팅 테이블 */
    private routingTable;
    /**
     * LLMRouter 생성
     * @param registry - ProviderRegistry 인스턴스
     */
    constructor(registry: ProviderRegistry);
    /**
     * 작업 유형에 맞는 프로바이더를 선택
     * @param task - LLM 작업 유형
     * @returns 적절한 LLMProvider
     * @throws {NoProviderConfiguredError}
     */
    route(task: LLMTask): LLMProvider;
    /**
     * 라우팅 테이블을 커스터마이즈
     * @param task - LLM 작업 유형
     * @param providerName - 프로바이더 이름
     */
    setRoute(task: LLMTask, providerName: string): void;
    /**
     * 현재 라우팅 테이블을 반환
     * @returns 라우팅 테이블 복사본
     */
    getRoutingTable(): Record<LLMTask, string>;
    /**
     * 작업 유형에 맞는 프로바이더를 선택하고 재시도 로직을 적용한 chat 호출
     *
     * Rate limit, 타임아웃 등 일시적 에러 발생 시
     * 지수 백오프(1초->2초->4초)로 최대 3회 재시도합니다.
     *
     * @param task - LLM 작업 유형
     * @param messages - 메시지 목록
     * @param options - LLM 호출 옵션
     * @param retryOpts - 재시도 옵션 (선택)
     * @returns LLM 응답
     */
    chatWithRetry(task: LLMTask, messages: Message[], options?: LLMOptions, retryOpts?: RetryOptions): Promise<LLMResponse>;
    /**
     * 폴백 프로바이더 선택
     * @returns 첫 번째 사용 가능한 프로바이더
     * @throws {NoProviderConfiguredError}
     */
    private getFallbackProvider;
}
//# sourceMappingURL=router.d.ts.map