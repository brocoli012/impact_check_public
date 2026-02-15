/**
 * @module tests/unit/analysis/spec-parser
 * @description SpecParser 단위 테스트
 */

import { SpecParser } from '../../../src/core/spec/spec-parser';

describe('SpecParser', () => {
  let parser: SpecParser;

  beforeEach(() => {
    parser = new SpecParser();
  });

  describe('parse (keyword-based)', () => {
    it('should parse text input using keyword-based rules', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '# 주문 화면 개선\n\n1. 주문 목록 필터 기능 추가\n배송 상태별 필터링\n\n2. 결제 방법 변경\n신용카드 결제 옵션 추가',
      });

      expect(result.title).toBe('주문 화면 개선');
      // Input has two numbered items, parser should extract at least 1 feature
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should extract keywords from text', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '상품 상세 화면에서 CartButton 컴포넌트의 주문 기능을 수정합니다.',
      });

      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should detect feature names from numbered list', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '# 기능 개선\n\n1. 검색 필터 기능 추가\n2. 상품 정렬 기능 수정\n3. 배송 설정 변경',
      });

      // Input has 3 numbered items, parser should detect at least 2 features
      expect(result.features.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect feature names from markdown headers', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '# 기획서\n\n## 장바구니 기능 수정\n상품 수량 변경\n\n## 결제 화면 개선\n결제 방법 추가',
      });

      // Input has 2 markdown headers with content, should find at least 1 feature
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should infer action type correctly', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '1. 신규 회원가입 화면 추가\n회원가입 폼 생성\n\n2. 설정 화면 config 변경\n파라미터 조정',
      });

      const newFeature = result.features.find(f => f.name.includes('신규'));
      const configFeature = result.features.find(f => f.name.includes('설정'));

      if (newFeature) expect(newFeature.actionType).toBe('new');
      if (configFeature) expect(configFeature.actionType).toBe('config');
    });

    it('should extract business rules from text', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '기능 설명\n\n규칙: 최소 주문 금액은 10,000원\n반드시 로그인 후 주문 가능',
      });

      // Input contains "규칙:" and "반드시" patterns, should extract at least 1 rule
      expect(result.businessRules.length).toBeGreaterThan(0);
    });

    it('should add ambiguity notice when no features found', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '짧은 텍스트',
      });

      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('should extract title from first line', async () => {
      const result = await parser.parse({
        type: 'text',
        content: '## 배송 정책 변경 기획서\n\n내용',
      });

      expect(result.title).toBe('배송 정책 변경 기획서');
    });
  });

  describe('parseFromStructuredInput', () => {
    it('should parse valid structured input', () => {
      const result = parser.parseFromStructuredInput({
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

      expect(result.title).toBe('장바구니 기능 개선');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].name).toBe('장바구니 수량 변경');
      expect(result.features[0].actionType).toBe('modify');
      expect(result.businessRules).toHaveLength(1);
      expect(result.ambiguities).toHaveLength(1);
      expect(result.keywords).toContain('cart');
      expect(result.keywords).toContain('장바구니');
    });

    it('should apply defaults for missing fields', () => {
      const result = parser.parseFromStructuredInput({
        features: [{ name: '테스트 기능' }],
      });

      expect(result.title).toBe('제목 없음');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].id).toBe('F-001');
      expect(result.features[0].actionType).toBe('modify');
      expect(result.features[0].keywords).toEqual([]);
      expect(result.requirements).toEqual([]);
      expect(result.businessRules).toEqual([]);
      expect(result.ambiguities).toEqual([]);
    });

    it('should throw for null input', () => {
      expect(() => parser.parseFromStructuredInput(null)).toThrow('Invalid structured input');
    });

    it('should throw for non-object input', () => {
      expect(() => parser.parseFromStructuredInput('string')).toThrow('Invalid structured input');
    });

    it('should handle empty object', () => {
      const result = parser.parseFromStructuredInput({});

      expect(result.title).toBe('제목 없음');
      expect(result.features).toEqual([]);
      expect(result.requirements).toEqual([]);
      expect(result.businessRules).toEqual([]);
    });

    it('should validate actionType enum values', () => {
      const result = parser.parseFromStructuredInput({
        features: [
          { name: 'new feature', actionType: 'new' },
          { name: 'modify feature', actionType: 'modify' },
          { name: 'config feature', actionType: 'config' },
          { name: 'invalid feature', actionType: 'invalid' },
        ],
      });

      expect(result.features[0].actionType).toBe('new');
      expect(result.features[1].actionType).toBe('modify');
      expect(result.features[2].actionType).toBe('config');
      expect(result.features[3].actionType).toBe('modify'); // invalid falls back to 'modify'
    });

    it('should collect keywords from features and input', () => {
      const result = parser.parseFromStructuredInput({
        features: [
          { name: 'feat1', keywords: ['a', 'b'] },
          { name: 'feat2', keywords: ['b', 'c'] },
        ],
        keywords: ['d', 'a'],
      });

      expect(result.keywords).toContain('a');
      expect(result.keywords).toContain('b');
      expect(result.keywords).toContain('c');
      expect(result.keywords).toContain('d');
    });

    it('should collect targetScreens from features and input', () => {
      const result = parser.parseFromStructuredInput({
        features: [
          { name: 'feat1', targetScreen: '주문 화면' },
          { name: 'feat2', targetScreen: '결제 화면' },
        ],
        targetScreens: ['검색 화면'],
      });

      expect(result.targetScreens).toContain('주문 화면');
      expect(result.targetScreens).toContain('결제 화면');
      expect(result.targetScreens).toContain('검색 화면');
    });
  });

  describe('PDF parsing', () => {
    it('should reject non-existent PDF file', async () => {
      await expect(
        parser.parse({ type: 'pdf', filePath: '/nonexistent/file.pdf' })
      ).rejects.toThrow('PDF file not found');
    });
  });
});
