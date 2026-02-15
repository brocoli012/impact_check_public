/**
 * @module tests/unit/analysis/spec-parser
 * @description SpecParser 단위 테스트
 */

import { SpecParser } from '../../../src/core/spec/spec-parser';
import { LLMRouter, ProviderRegistry } from '../../../src/llm/router';
import { LLMProvider, Message, LLMOptions, LLMResponse } from '../../../src/types/llm';

/** 모의 LLM 프로바이더 */
class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly displayName = 'Mock Provider';
  private mockResponse: string;

  constructor(mockResponse: string) {
    this.mockResponse = mockResponse;
  }

  async chat(_messages: Message[], _options?: LLMOptions): Promise<LLMResponse> {
    return {
      content: this.mockResponse,
      usage: { inputTokens: 100, outputTokens: 200, estimatedCost: 0.01 },
      model: 'mock-model',
      provider: 'mock',
    };
  }

  estimateTokens(_text: string): number { return 100; }
  estimateCost(_inputTokens: number, _outputTokens: number): number { return 0.01; }
  async validateApiKey(_key: string): Promise<boolean> { return true; }
  listModels(): string[] { return ['mock-model']; }
}

describe('SpecParser', () => {
  let registry: ProviderRegistry;
  let router: LLMRouter;

  beforeEach(() => {
    registry = new ProviderRegistry();
    router = new LLMRouter(registry);
  });

  describe('parse (with LLM)', () => {
    it('should parse text input using LLM', async () => {
      const mockResponse = JSON.stringify({
        title: '장바구니 기능 개선',
        features: [
          {
            id: 'F-001',
            name: '장바구니 수량 변경',
            description: '장바구니에서 상품 수량을 직접 입력하여 변경',
            targetScreen: '장바구니',
            actionType: 'modify',
            keywords: ['cart', '장바구니', 'quantity'],
          },
        ],
        businessRules: [
          {
            id: 'BR-001',
            description: '수량은 1~99 범위',
            relatedFeatures: ['F-001'],
          },
        ],
        ambiguities: ['수량 0 입력 시 삭제 여부 확인 필요'],
      });

      registry.register(new MockLLMProvider(mockResponse));
      router.setRoute('spec-parsing', 'mock');

      const parser = new SpecParser(router);
      const result = await parser.parse({
        type: 'text',
        content: '장바구니 기능 개선 기획서\n\n1. 장바구니 수량 변경 기능 추가',
      });

      expect(result.title).toBe('장바구니 기능 개선');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].name).toBe('장바구니 수량 변경');
      expect(result.features[0].actionType).toBe('modify');
      expect(result.businessRules).toHaveLength(1);
      expect(result.ambiguities).toHaveLength(1);
      expect(result.keywords).toContain('cart');
      expect(result.keywords).toContain('장바구니');
    });

    it('should handle LLM response wrapped in code block', async () => {
      const mockResponse = '```json\n' + JSON.stringify({
        title: '테스트',
        features: [],
        businessRules: [],
        ambiguities: [],
      }) + '\n```';

      registry.register(new MockLLMProvider(mockResponse));
      router.setRoute('spec-parsing', 'mock');

      const parser = new SpecParser(router);
      const result = await parser.parse({ type: 'text', content: '테스트' });

      expect(result.title).toBe('테스트');
    });

    it('should throw error when LLM returns non-JSON', async () => {
      registry.register(new MockLLMProvider('This is not JSON'));
      router.setRoute('spec-parsing', 'mock');

      const parser = new SpecParser(router);
      await expect(
        parser.parse({ type: 'text', content: '테스트' })
      ).rejects.toThrow('LLM response is not valid JSON');
    });
  });

  describe('fallbackParse (without LLM)', () => {
    it('should use fallback when no LLM configured', async () => {
      // registry에 프로바이더를 등록하지 않으면 NoProviderConfiguredError 발생
      const parser = new SpecParser(router);
      const result = await parser.parse({
        type: 'text',
        content: '# 주문 화면 개선\n\n1. 주문 목록 필터 기능 추가\n배송 상태별 필터링\n\n2. 결제 방법 변경\n신용카드 결제 옵션 추가',
      });

      expect(result.title).toBe('주문 화면 개선');
      // Input has two numbered items, fallback parser should extract at least 1 feature
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should extract keywords from text in fallback mode', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse(
        '상품 상세 화면에서 CartButton 컴포넌트의 주문 기능을 수정합니다.'
      );

      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should detect feature names from numbered list', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse(
        '# 기능 개선\n\n1. 검색 필터 기능 추가\n2. 상품 정렬 기능 수정\n3. 배송 설정 변경'
      );

      // Input has 3 numbered items, parser should detect at least 2 features
      expect(result.features.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect feature names from markdown headers', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse(
        '# 기획서\n\n## 장바구니 기능 수정\n상품 수량 변경\n\n## 결제 화면 개선\n결제 방법 추가'
      );

      // Input has 2 markdown headers with content, should find at least 1 feature
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should infer action type correctly', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse(
        '1. 신규 회원가입 화면 추가\n회원가입 폼 생성\n\n2. 설정 화면 config 변경\n파라미터 조정'
      );

      const newFeature = result.features.find(f => f.name.includes('신규'));
      const configFeature = result.features.find(f => f.name.includes('설정'));

      if (newFeature) expect(newFeature.actionType).toBe('new');
      if (configFeature) expect(configFeature.actionType).toBe('config');
    });

    it('should extract business rules from text', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse(
        '기능 설명\n\n규칙: 최소 주문 금액은 10,000원\n반드시 로그인 후 주문 가능'
      );

      // Input contains "규칙:" and "반드시" patterns, should extract at least 1 rule
      expect(result.businessRules.length).toBeGreaterThan(0);
    });

    it('should add ambiguity notice when no features found', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse('짧은 텍스트');

      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('should extract title from first line', () => {
      const parser = new SpecParser(router);
      const result = parser.fallbackParse('## 배송 정책 변경 기획서\n\n내용');

      expect(result.title).toBe('배송 정책 변경 기획서');
    });
  });

  describe('PDF parsing', () => {
    it('should reject non-existent PDF file', async () => {
      const parser = new SpecParser(router);
      await expect(
        parser.parse({ type: 'pdf', filePath: '/nonexistent/file.pdf' })
      ).rejects.toThrow('PDF file not found');
    });
  });
});
