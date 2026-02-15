/**
 * @module llm/router
 * @description LLM 라우터 - 용도별 최적 프로바이더 자동 선택
 */

import { LLMProvider, LLMTask, ProviderInfo } from '../types/llm';
import { logger } from '../utils/logger';

/** 프로바이더를 찾을 수 없는 에러 */
export class ProviderNotFoundError extends Error {
  constructor(name: string) {
    super(`LLM provider not found: '${name}'`);
    this.name = 'ProviderNotFoundError';
  }
}

/** 프로바이더가 설정되지 않은 에러 */
export class NoProviderConfiguredError extends Error {
  constructor() {
    super('No LLM provider is configured. Run "/impact config" to set up a provider.');
    this.name = 'NoProviderConfiguredError';
  }
}

/**
 * ProviderRegistry - LLM 프로바이더 등록/관리
 */
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  /**
   * 프로바이더 등록
   * @param provider - LLMProvider 인스턴스
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    logger.debug(`LLM provider registered: ${provider.name}`);
  }

  /**
   * 프로바이더 조회
   * @param name - 프로바이더 이름
   * @returns LLMProvider 인스턴스
   * @throws {ProviderNotFoundError}
   */
  get(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ProviderNotFoundError(name);
    }
    return provider;
  }

  /**
   * 프로바이더 존재 여부 확인
   * @param name - 프로바이더 이름
   * @returns 존재 여부
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * 등록된 프로바이더 목록 조회
   * @returns 프로바이더 정보 배열
   */
  list(): ProviderInfo[] {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      displayName: p.displayName,
      models: p.listModels(),
    }));
  }
}

/**
 * LLMRouter - 용도별 프로바이더 자동 선택
 */
export class LLMRouter {
  private readonly registry: ProviderRegistry;

  /** 기본 라우팅 테이블 */
  private routingTable: Record<LLMTask, string> = {
    'spec-parsing': 'openai',
    'impact-analysis': 'anthropic',
    'score-calculation': 'anthropic',
    'multimodal-parsing': 'google',
    'general': 'openai',
  };

  /**
   * LLMRouter 생성
   * @param registry - ProviderRegistry 인스턴스
   */
  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  /**
   * 작업 유형에 맞는 프로바이더를 선택
   * @param task - LLM 작업 유형
   * @returns 적절한 LLMProvider
   * @throws {NoProviderConfiguredError}
   */
  route(task: LLMTask): LLMProvider {
    const providerName = this.routingTable[task];

    if (this.registry.has(providerName)) {
      return this.registry.get(providerName);
    }

    logger.debug(`Provider '${providerName}' not available for task '${task}'. Using fallback.`);
    return this.getFallbackProvider();
  }

  /**
   * 라우팅 테이블을 커스터마이즈
   * @param task - LLM 작업 유형
   * @param providerName - 프로바이더 이름
   */
  setRoute(task: LLMTask, providerName: string): void {
    this.routingTable[task] = providerName;
    logger.debug(`Route updated: ${task} -> ${providerName}`);
  }

  /**
   * 현재 라우팅 테이블을 반환
   * @returns 라우팅 테이블 복사본
   */
  getRoutingTable(): Record<LLMTask, string> {
    return { ...this.routingTable };
  }

  /**
   * 폴백 프로바이더 선택
   * @returns 첫 번째 사용 가능한 프로바이더
   * @throws {NoProviderConfiguredError}
   */
  private getFallbackProvider(): LLMProvider {
    const available = this.registry.list();
    if (available.length === 0) {
      throw new NoProviderConfiguredError();
    }
    return this.registry.get(available[0].name);
  }
}
