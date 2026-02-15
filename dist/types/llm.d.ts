/**
 * @module types/llm
 * @description LLM 관련 타입 정의 - 멀티 프로바이더 추상화 레이어
 */
/** LLM 메시지 */
export interface Message {
    /** 메시지 역할 */
    role: 'system' | 'user' | 'assistant';
    /** 메시지 내용 */
    content: string | ContentBlock[];
}
/** 콘텐츠 블록 */
export interface ContentBlock {
    /** 블록 타입 */
    type: 'text' | 'image';
    /** 텍스트 내용 */
    text?: string;
    /** 이미지 URL */
    imageUrl?: string;
    /** MIME 타입 */
    mimeType?: string;
}
/** LLM 호출 옵션 */
export interface LLMOptions {
    /** 모델명 */
    model?: string;
    /** 최대 출력 토큰 */
    maxTokens?: number;
    /** 온도 (0.0~2.0) */
    temperature?: number;
    /** 응답 포맷 */
    responseFormat?: 'text' | 'json';
    /** 구조화 출력용 JSON 스키마 */
    jsonSchema?: object;
}
/** LLM 응답 */
export interface LLMResponse {
    /** 응답 내용 */
    content: string;
    /** 사용량 정보 */
    usage: {
        /** 입력 토큰 수 */
        inputTokens: number;
        /** 출력 토큰 수 */
        outputTokens: number;
        /** 예상 비용 (USD) */
        estimatedCost: number;
    };
    /** 사용된 모델명 */
    model: string;
    /** 프로바이더명 */
    provider: string;
}
/** LLM 프로바이더 인터페이스 - 모든 프로바이더가 구현해야 하는 공통 인터페이스 */
export interface LLMProvider {
    /** 프로바이더 고유 이름 */
    readonly name: string;
    /** 표시 이름 */
    readonly displayName: string;
    /**
     * 채팅 메시지를 전송하고 응답을 받음
     * @param messages - 메시지 목록
     * @param options - 호출 옵션
     * @returns LLM 응답
     */
    chat(messages: Message[], options?: LLMOptions): Promise<LLMResponse>;
    /**
     * 텍스트의 토큰 수를 추정
     * @param text - 대상 텍스트
     * @returns 추정 토큰 수
     */
    estimateTokens(text: string): number;
    /**
     * 비용을 추정
     * @param inputTokens - 입력 토큰 수
     * @param outputTokens - 출력 토큰 수
     * @param model - 모델명 (선택)
     * @returns 추정 비용 (USD)
     */
    estimateCost(inputTokens: number, outputTokens: number, model?: string): number;
    /**
     * API 키의 유효성을 검증
     * @param key - API 키
     * @returns 유효 여부
     */
    validateApiKey(key: string): Promise<boolean>;
    /**
     * 지원 모델 목록을 반환
     * @returns 모델명 배열
     */
    listModels(): string[];
}
/** LLM 작업 유형 - 용도별 라우팅에 사용 */
export type LLMTask = 'spec-parsing' | 'impact-analysis' | 'score-calculation' | 'multimodal-parsing' | 'general';
/** 프로바이더 정보 */
export interface ProviderInfo {
    /** 프로바이더 이름 */
    name: string;
    /** 표시 이름 */
    displayName: string;
    /** 지원 모델 목록 */
    models: string[];
}
/** 비용 기록 */
export interface CostRecord {
    /** 기록 시각 */
    timestamp: Date;
    /** 프로바이더명 */
    provider: string;
    /** 모델명 */
    model: string;
    /** 입력 토큰 */
    inputTokens: number;
    /** 출력 토큰 */
    outputTokens: number;
    /** 비용 (USD) */
    cost: number;
}
/** 비용 요약 */
export interface CostSummary {
    /** 전체 비용 (USD) */
    totalCost: number;
    /** 전체 토큰 수 */
    totalTokens: number;
    /** 프로바이더별 비용 */
    byProvider: Record<string, number>;
    /** API 호출 수 */
    callCount: number;
}
/** 비용 추정 */
export interface CostEstimate {
    /** 추정 비용 (USD) */
    estimatedCost: number;
    /** 추정 비용 (KRW) */
    estimatedCostKrw: number;
    /** 추정 토큰 수 */
    estimatedTokens: number;
    /** 표시 메시지 */
    displayMessage: string;
    /** 경고 메시지 */
    warning?: string;
}
//# sourceMappingURL=llm.d.ts.map