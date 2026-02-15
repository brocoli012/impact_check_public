"use strict";
/**
 * @module llm/google
 * @description Google (Gemini) LLM 프로바이더 - 스텁 구현
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleProvider = void 0;
/**
 * GoogleProvider - Google Gemini API 프로바이더
 *
 * Phase 1에서는 스텁으로 구현. Phase 2에서 실제 API 연동.
 *
 * 주요 용도:
 *   - PDF/이미지 분석 (multimodal-parsing)
 *   - 대용량 컨텍스트 처리
 */
class GoogleProvider {
    /**
     * GoogleProvider 생성
     * @param _apiKey - Google API 키
     */
    constructor(_apiKey) {
        this.name = 'google';
        this.displayName = 'Google (Gemini)';
        // API key stored for future use in Phase 2
    }
    /**
     * 채팅 메시지 전송 (스텁)
     * @param _messages - 메시지 목록
     * @param _options - 호출 옵션
     * @returns LLM 응답
     */
    async chat(_messages, _options) {
        return {
            content: '[Google Provider Stub] Not implemented yet.',
            usage: {
                inputTokens: 0,
                outputTokens: 0,
                estimatedCost: 0,
            },
            model: _options?.model || 'gemini-2.0-flash',
            provider: this.name,
        };
    }
    /**
     * 토큰 수 추정
     * @param text - 대상 텍스트
     * @returns 추정 토큰 수
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * 비용 추정
     * @param inputTokens - 입력 토큰
     * @param outputTokens - 출력 토큰
     * @param _model - 모델명
     * @returns 추정 비용 (USD)
     */
    estimateCost(inputTokens, outputTokens, _model) {
        // Gemini 2.0 Flash 기준 가격 (근사치)
        const inputCost = (inputTokens / 1000000) * 0.075;
        const outputCost = (outputTokens / 1000000) * 0.30;
        return inputCost + outputCost;
    }
    /**
     * API 키 유효성 검증 (스텁)
     * @param _key - API 키
     * @returns 유효 여부
     */
    async validateApiKey(_key) {
        return _key.startsWith('AIza');
    }
    /**
     * 지원 모델 목록
     * @returns 모델명 배열
     */
    listModels() {
        return [
            'gemini-2.0-flash',
            'gemini-2.0-pro',
            'gemini-1.5-pro',
        ];
    }
}
exports.GoogleProvider = GoogleProvider;
//# sourceMappingURL=google.js.map