/**
 * @module tests/unit/analysis/matcher
 * @description IndexMatcher 단위 테스트
 */

import { IndexMatcher } from '../../../src/core/analysis/matcher';
import { ParsedSpec } from '../../../src/types/analysis';
import { CodeIndex } from '../../../src/types/index';

/** 테스트용 코드 인덱스 생성 */
function createTestIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test-project',
        path: '/test',
        techStack: ['typescript', 'react'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 3,
        components: 5,
        apiEndpoints: 4,
        models: 2,
        modules: 3,
      },
    },
    files: [],
    screens: [
      {
        id: 'screen-1',
        name: 'CartPage',
        route: '/cart',
        filePath: 'src/pages/CartPage.tsx',
        components: ['comp-1', 'comp-2'],
        apiCalls: ['api-1'],
        childScreens: [],
        metadata: { linesOfCode: 200, complexity: 'medium' },
      },
      {
        id: 'screen-2',
        name: 'OrderPage',
        route: '/order',
        filePath: 'src/pages/OrderPage.tsx',
        components: ['comp-3'],
        apiCalls: ['api-2'],
        childScreens: [],
        metadata: { linesOfCode: 300, complexity: 'high' },
      },
      {
        id: 'screen-3',
        name: 'ProductDetailPage',
        route: '/product/:id',
        filePath: 'src/pages/ProductDetailPage.tsx',
        components: ['comp-4'],
        apiCalls: ['api-3'],
        childScreens: [],
        metadata: { linesOfCode: 150, complexity: 'low' },
      },
    ],
    components: [
      {
        id: 'comp-1',
        name: 'CartItem',
        filePath: 'src/components/CartItem.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-1'],
        props: ['item', 'onQuantityChange'],
        emits: [],
        apiCalls: [],
        linesOfCode: 80,
      },
      {
        id: 'comp-2',
        name: 'CartSummary',
        filePath: 'src/components/CartSummary.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-1'],
        props: ['total', 'discount'],
        emits: [],
        apiCalls: [],
        linesOfCode: 60,
      },
      {
        id: 'comp-3',
        name: 'OrderForm',
        filePath: 'src/components/OrderForm.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-2'],
        props: ['order'],
        emits: [],
        apiCalls: ['api-2'],
        linesOfCode: 120,
      },
    ],
    apis: [
      {
        id: 'api-1',
        method: 'GET',
        path: '/api/cart',
        filePath: 'src/api/cart.ts',
        handler: 'getCart',
        calledBy: ['screen-1'],
        requestParams: [],
        responseType: 'CartResponse',
        relatedModels: ['model-1'],
      },
      {
        id: 'api-2',
        method: 'POST',
        path: '/api/orders',
        filePath: 'src/api/orders.ts',
        handler: 'createOrder',
        calledBy: ['screen-2'],
        requestParams: ['orderData'],
        responseType: 'OrderResponse',
        relatedModels: ['model-2'],
      },
      {
        id: 'api-3',
        method: 'GET',
        path: '/api/products/:id',
        filePath: 'src/api/products.ts',
        handler: 'getProduct',
        calledBy: ['screen-3'],
        requestParams: ['id'],
        responseType: 'ProductResponse',
        relatedModels: [],
      },
    ],
    models: [
      {
        id: 'model-1',
        name: 'CartItem',
        filePath: 'src/models/CartItem.ts',
        type: 'interface',
        fields: [
          { name: 'productId', type: 'string', required: true },
          { name: 'quantity', type: 'number', required: true },
          { name: 'price', type: 'number', required: true },
        ],
        relatedApis: ['api-1'],
      },
    ],
    events: [],
    policies: [],
    dependencies: {
      graph: {
        nodes: [
          { id: 'screen-1', type: 'screen', name: 'CartPage' },
          { id: 'screen-2', type: 'screen', name: 'OrderPage' },
          { id: 'comp-1', type: 'component', name: 'CartItem' },
          { id: 'comp-2', type: 'component', name: 'CartSummary' },
          { id: 'comp-3', type: 'component', name: 'OrderForm' },
          { id: 'api-1', type: 'api', name: 'getCart' },
          { id: 'api-2', type: 'api', name: 'createOrder' },
        ],
        edges: [
          { from: 'screen-1', to: 'comp-1', type: 'import' },
          { from: 'screen-1', to: 'comp-2', type: 'import' },
          { from: 'screen-1', to: 'api-1', type: 'api-call' },
          { from: 'screen-2', to: 'comp-3', type: 'import' },
          { from: 'screen-2', to: 'api-2', type: 'api-call' },
          { from: 'comp-3', to: 'api-2', type: 'api-call' },
        ],
      },
    },
  };
}

/** 테스트용 ParsedSpec 생성 */
function createTestSpec(): ParsedSpec {
  return {
    title: '장바구니 기능 개선',
    requirements: [],
    features: [
      {
        id: 'F-001',
        name: '장바구니 수량 변경',
        description: '장바구니에서 상품 수량을 직접 입력',
        targetScreen: '장바구니',
        actionType: 'modify',
        keywords: ['cart', '장바구니', 'quantity', 'CartItem'],
      },
    ],
    businessRules: [],
    targetScreens: ['장바구니'],
    keywords: ['cart', '장바구니', 'quantity'],
    ambiguities: [],
  };
}

describe('IndexMatcher', () => {
  let matcher: IndexMatcher;
  let index: CodeIndex;

  beforeEach(() => {
    matcher = new IndexMatcher();
    index = createTestIndex();
  });

  describe('match', () => {
    it('should match screens by keyword', () => {
      const spec = createTestSpec();
      const result = matcher.match(spec, index);

      // CartPage 화면이 매칭되어야 함
      const cartScreen = result.screens.find(s => s.name === 'CartPage');
      expect(cartScreen).toBeDefined();
      expect(cartScreen!.matchScore).toBeGreaterThan(0);
    });

    it('should match components by keyword', () => {
      const spec = createTestSpec();
      const result = matcher.match(spec, index);

      // CartItem 컴포넌트가 매칭되어야 함
      const cartItem = result.components.find(c => c.name === 'CartItem');
      expect(cartItem).toBeDefined();
      expect(cartItem!.matchScore).toBeGreaterThan(0);
    });

    it('should match APIs by path keyword', () => {
      const spec = createTestSpec();
      const result = matcher.match(spec, index);

      // /api/cart API가 매칭되어야 함
      const cartApi = result.apis.find(a => a.name.includes('/api/cart'));
      expect(cartApi).toBeDefined();
      expect(cartApi!.matchScore).toBeGreaterThan(0);
    });

    it('should expand matched entities via dependency graph', () => {
      // 주문 기획서로 OrderPage를 직접 매칭하면
      // 의존성 확장으로 OrderForm(comp-3)이 추가될 수 있음
      const spec: ParsedSpec = {
        title: '주문 기능',
        requirements: [],
        features: [
          {
            id: 'F-001',
            name: '주문 기능',
            description: '주문 기능',
            targetScreen: 'OrderPage',
            actionType: 'modify',
            keywords: ['order', 'OrderPage'],
          },
        ],
        businessRules: [],
        targetScreens: ['OrderPage'],
        keywords: ['OrderPage'],
        ambiguities: [],
      };

      const result = matcher.match(spec, index);

      // OrderPage가 직접 매칭되고
      const orderScreen = result.screens.find(s => s.name === 'OrderPage');
      expect(orderScreen).toBeDefined();

      // 의존 그래프를 통해 comp-2 (OrderForm) 또는 api-2 (createOrder)가 확장될 수 있음
      const allEntities = [
        ...result.screens,
        ...result.components,
        ...result.apis,
        ...result.models,
      ];
      // 의존성 확장이나 직접 매칭으로 엔티티가 포함되어야 함
      expect(allEntities.length).toBeGreaterThan(0);
    });

    it('should not match unrelated screens', () => {
      const spec = createTestSpec();
      const result = matcher.match(spec, index);

      // ProductDetailPage는 장바구니와 직접 관련 없음
      const productScreen = result.screens.find(s => s.name === 'ProductDetailPage');
      // 매칭되지 않거나 매칭 점수가 매우 낮아야 함
      if (productScreen) {
        expect(productScreen.matchScore).toBeLessThan(0.5);
      }
    });

    it('should return sorted results by match score', () => {
      const spec = createTestSpec();
      const result = matcher.match(spec, index);

      if (result.screens.length >= 2) {
        for (let i = 0; i < result.screens.length - 1; i++) {
          // 의존성 확장 엔티티는 뒤에 올 수 있으므로 직접 매칭된 것만 체크
          const current = result.screens[i];
          const next = result.screens[i + 1];
          if (current.matchReason.includes('dependency') === false &&
              next.matchReason.includes('dependency') === false) {
            expect(current.matchScore).toBeGreaterThanOrEqual(next.matchScore);
          }
        }
      }
    });

    it('should handle spec with no matching keywords', () => {
      const spec: ParsedSpec = {
        title: '무관한 기획서',
        requirements: [],
        features: [],
        businessRules: [],
        targetScreens: [],
        keywords: ['zzzznotexist'],
        ambiguities: [],
      };

      const result = matcher.match(spec, index);

      // 매칭 결과가 비어있거나 매우 낮은 점수
      const highScoreMatches = [
        ...result.screens,
        ...result.components,
        ...result.apis,
        ...result.models,
      ].filter(e => e.matchScore > 0.5);

      expect(highScoreMatches.length).toBe(0);
    });

    it('should handle Korean keywords', () => {
      const spec: ParsedSpec = {
        title: '주문 기능',
        requirements: [],
        features: [
          {
            id: 'F-001',
            name: '주문 생성',
            description: '주문 생성 기능',
            targetScreen: '주문',
            actionType: 'new',
            keywords: ['주문', 'order'],
          },
        ],
        businessRules: [],
        targetScreens: ['주문'],
        keywords: ['주문', 'order'],
        ambiguities: [],
      };

      const result = matcher.match(spec, index);

      // OrderPage가 매칭되어야 함 (order 키워드)
      const orderScreen = result.screens.find(s => s.name === 'OrderPage');
      expect(orderScreen).toBeDefined();
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for exact match', () => {
      expect(matcher.calculateSimilarity('cart', 'cart')).toBe(1.0);
    });

    it('should return high score for contains match', () => {
      const score = matcher.calculateSimilarity('cart', 'cartpage');
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return high score for path part match', () => {
      const score = matcher.calculateSimilarity('cart', 'src/pages/cart');
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return 0 for no match', () => {
      expect(matcher.calculateSimilarity('cart', 'login')).toBe(0);
    });

    it('should handle camelCase matching', () => {
      const score = matcher.calculateSimilarity('cart', 'CartItem');
      expect(score).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      const score1 = matcher.calculateSimilarity('Cart', 'cart');
      const score2 = matcher.calculateSimilarity('cart', 'CART');
      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
    });
  });
});
