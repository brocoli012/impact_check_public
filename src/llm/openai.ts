/**
 * @module llm/openai
 * @description OpenAI (GPT) LLM 프로바이더 - 스텁 구현
 */

import { LLMProvider, Message, LLMOptions, LLMResponse } from '../types/llm';

/**
 * OpenAIProvider - OpenAI GPT API 프로바이더
 *
 * Phase 1에서는 스텁으로 구현. Phase 2에서 실제 API 연동.
 *
 * 주요 용도:
 *   - 기획서 파싱 (spec-parsing)
 *   - 범용 텍스트 처리 (general)
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI (GPT)';

  /**
   * OpenAIProvider 생성
   * @param _apiKey - OpenAI API 키
   */
  constructor(_apiKey: string) {
    // API key stored for future use in Phase 2
  }

  /**
   * 채팅 메시지 전송 (스텁)
   * @param _messages - 메시지 목록
   * @param _options - 호출 옵션
   * @returns LLM 응답
   */
  async chat(_messages: Message[], _options?: LLMOptions): Promise<LLMResponse> {
    return {
      content: '[OpenAI Provider Stub] Not implemented yet.',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
      },
      model: _options?.model || 'gpt-4o',
      provider: this.name,
    };
  }

  /**
   * 토큰 수 추정
   * @param text - 대상 텍스트
   * @returns 추정 토큰 수
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 비용 추정
   * @param inputTokens - 입력 토큰
   * @param outputTokens - 출력 토큰
   * @param _model - 모델명
   * @returns 추정 비용 (USD)
   */
  estimateCost(inputTokens: number, outputTokens: number, _model?: string): number {
    // GPT-4o 기준 가격 (근사치)
    const inputCost = (inputTokens / 1_000_000) * 2.5;
    const outputCost = (outputTokens / 1_000_000) * 10.0;
    return inputCost + outputCost;
  }

  /**
   * API 키 유효성 검증 (스텁)
   * @param _key - API 키
   * @returns 유효 여부
   */
  async validateApiKey(_key: string): Promise<boolean> {
    return _key.startsWith('sk-');
  }

  /**
   * 지원 모델 목록
   * @returns 모델명 배열
   */
  listModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
    ];
  }
}
