/**
 * @module tests/unit/llm-router
 * @description LLM 라우터 및 프로바이더 레지스트리 단위 테스트
 */

import {
  ProviderRegistry,
  LLMRouter,
  ProviderNotFoundError,
  NoProviderConfiguredError,
} from '../../src/llm/router';
import { AnthropicProvider } from '../../src/llm/anthropic';
import { OpenAIProvider } from '../../src/llm/openai';
import { GoogleProvider } from '../../src/llm/google';
import { LLMTask } from '../../src/types/llm';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register a provider', () => {
    const provider = new AnthropicProvider('test-key');
    registry.register(provider);
    expect(registry.has('anthropic')).toBe(true);
  });

  it('should get a registered provider', () => {
    const provider = new AnthropicProvider('test-key');
    registry.register(provider);
    const retrieved = registry.get('anthropic');
    expect(retrieved.name).toBe('anthropic');
    expect(retrieved.displayName).toBe('Anthropic (Claude)');
  });

  it('should throw ProviderNotFoundError for unregistered provider', () => {
    expect(() => registry.get('nonexistent')).toThrow(ProviderNotFoundError);
  });

  it('should list all registered providers', () => {
    registry.register(new AnthropicProvider('key1'));
    registry.register(new OpenAIProvider('key2'));
    registry.register(new GoogleProvider('key3'));

    const list = registry.list();
    expect(list.length).toBe(3);
    expect(list.map(p => p.name)).toContain('anthropic');
    expect(list.map(p => p.name)).toContain('openai');
    expect(list.map(p => p.name)).toContain('google');
  });

  it('should return provider info with models', () => {
    registry.register(new AnthropicProvider('key'));
    const list = registry.list();
    expect(list[0].models.length).toBeGreaterThan(0);
    expect(list[0].models).toContain('claude-sonnet-4-20250514');
  });
});

describe('LLMRouter', () => {
  let registry: ProviderRegistry;
  let router: LLMRouter;

  beforeEach(() => {
    registry = new ProviderRegistry();
    router = new LLMRouter(registry);
  });

  it('should route to the correct provider based on task', () => {
    registry.register(new AnthropicProvider('key1'));
    registry.register(new OpenAIProvider('key2'));
    registry.register(new GoogleProvider('key3'));

    expect(router.route('impact-analysis').name).toBe('anthropic');
    expect(router.route('score-calculation').name).toBe('anthropic');
    expect(router.route('spec-parsing').name).toBe('openai');
    expect(router.route('general').name).toBe('openai');
    expect(router.route('multimodal-parsing').name).toBe('google');
  });

  it('should fallback to first available provider when preferred is not available', () => {
    registry.register(new AnthropicProvider('key1'));
    // OpenAI is not registered, so spec-parsing should fallback
    const provider = router.route('spec-parsing');
    expect(provider.name).toBe('anthropic');
  });

  it('should throw NoProviderConfiguredError when no providers are available', () => {
    expect(() => router.route('general')).toThrow(NoProviderConfiguredError);
  });

  it('should allow customizing the routing table', () => {
    registry.register(new AnthropicProvider('key1'));
    registry.register(new OpenAIProvider('key2'));

    router.setRoute('spec-parsing', 'anthropic');
    expect(router.route('spec-parsing').name).toBe('anthropic');
  });

  it('should return the routing table', () => {
    const table = router.getRoutingTable();
    expect(table['impact-analysis']).toBe('anthropic');
    expect(table['spec-parsing']).toBe('openai');
    expect(table['multimodal-parsing']).toBe('google');
  });
});

describe('LLM Provider Stubs', () => {
  describe('AnthropicProvider', () => {
    const provider = new AnthropicProvider('sk-ant-test');

    it('should return stub response from chat', async () => {
      const response = await provider.chat([{ role: 'user', content: 'Hello' }]);
      expect(response.content).toContain('Stub');
      expect(response.provider).toBe('anthropic');
    });

    it('should estimate tokens', () => {
      const tokens = provider.estimateTokens('Hello World');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate cost', () => {
      const cost = provider.estimateCost(1000, 500);
      expect(cost).toBeGreaterThan(0);
    });

    it('should validate API key format', async () => {
      expect(await provider.validateApiKey('sk-ant-test')).toBe(true);
      expect(await provider.validateApiKey('invalid')).toBe(false);
    });

    it('should list models', () => {
      const models = provider.listModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('OpenAIProvider', () => {
    const provider = new OpenAIProvider('sk-test');

    it('should return stub response from chat', async () => {
      const response = await provider.chat([{ role: 'user', content: 'Hello' }]);
      expect(response.content).toContain('Stub');
      expect(response.provider).toBe('openai');
    });

    it('should validate API key format', async () => {
      expect(await provider.validateApiKey('sk-test')).toBe(true);
      expect(await provider.validateApiKey('invalid')).toBe(false);
    });
  });

  describe('GoogleProvider', () => {
    const provider = new GoogleProvider('AIza-test');

    it('should return stub response from chat', async () => {
      const response = await provider.chat([{ role: 'user', content: 'Hello' }]);
      expect(response.content).toContain('Stub');
      expect(response.provider).toBe('google');
    });

    it('should validate API key format', async () => {
      expect(await provider.validateApiKey('AIza-test')).toBe(true);
      expect(await provider.validateApiKey('invalid')).toBe(false);
    });
  });
});

// Suppress unused import warning
void (null as unknown as LLMTask);
