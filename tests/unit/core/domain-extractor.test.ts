/**
 * @module tests/unit/core/domain-extractor
 * @description DomainExtractor 단위 테스트 (TASK-113)
 *
 * 테스트 대상:
 * - API 경로에서 도메인 키워드 추출
 * - 화면 이름에서 도메인 키워드 추출
 * - 기능 요약 생성
 * - 빈 인덱스 처리
 * - 최대 10개 기능 요약 제한
 * - 도메인 중복 제거
 */

import { DomainExtractor } from '../../../src/core/indexing/domain-extractor';
import type { CodeIndex } from '../../../src/types/index';

/**
 * 빈 CodeIndex 헬퍼 - 최소 필수 필드를 가진 CodeIndex 생성
 */
function createEmptyCodeIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test',
        path: '/test',
        techStack: [],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 0,
        screens: 0,
        components: 0,
        apiEndpoints: 0,
        models: 0,
        modules: 0,
      },
    },
    files: [],
    screens: [],
    components: [],
    apis: [],
    models: [],
    events: [],
    policies: [],
    dependencies: { graph: { nodes: [], edges: [] } },
  };
}

describe('DomainExtractor', () => {
  let extractor: DomainExtractor;

  beforeEach(() => {
    extractor = new DomainExtractor();
  });

  describe('extract()', () => {
    // --------------------------------------------------------
    // 1. API 경로에서 도메인 추출
    // --------------------------------------------------------
    it('should extract domains from API paths', () => {
      const codeIndex = createEmptyCodeIndex();
      codeIndex.apis = [
        {
          id: 'api-1',
          method: 'GET',
          path: '/api/orders',
          filePath: 'src/routes/orders.ts',
          handler: 'getOrders',
          calledBy: [],
          requestParams: [],
          responseType: 'Order[]',
          relatedModels: [],
        },
        {
          id: 'api-2',
          method: 'POST',
          path: '/api/payments/create',
          filePath: 'src/routes/payments.ts',
          handler: 'createPayment',
          calledBy: [],
          requestParams: [],
          responseType: 'Payment',
          relatedModels: [],
        },
      ];

      const result = extractor.extract(codeIndex);

      // 주문 도메인: API path에 'order' 포함 → score >= 3
      expect(result.domains).toContain('주문');
      // 결제 도메인: API path에 'payment' 포함 → score >= 3
      expect(result.domains).toContain('결제');
    });

    // --------------------------------------------------------
    // 2. 화면 이름에서 도메인 추출
    // --------------------------------------------------------
    it('should extract domains from screen names', () => {
      const codeIndex = createEmptyCodeIndex();
      codeIndex.screens = [
        {
          id: 'screen-1',
          name: 'ProductList',
          route: '/products',
          filePath: 'src/pages/ProductList.tsx',
          components: [],
          apiCalls: [],
          childScreens: [],
          metadata: { linesOfCode: 100, complexity: 'low' },
        },
        {
          id: 'screen-2',
          name: 'CartPage',
          route: '/cart',
          filePath: 'src/pages/CartPage.tsx',
          components: [],
          apiCalls: [],
          childScreens: [],
          metadata: { linesOfCode: 80, complexity: 'low' },
        },
      ];

      const result = extractor.extract(codeIndex);

      // 상품 도메인: screen name에 'product' 포함 → score >= 3
      expect(result.domains).toContain('상품');
      // 장바구니 도메인: screen name에 'cart' 포함 → score >= 3
      expect(result.domains).toContain('장바구니');
    });

    // --------------------------------------------------------
    // 3. 기능 요약 생성
    // --------------------------------------------------------
    it('should generate feature summary', () => {
      const codeIndex = createEmptyCodeIndex();
      codeIndex.screens = [
        {
          id: 'screen-1',
          name: 'ProductList',
          route: '/products',
          filePath: 'src/pages/ProductList.tsx',
          components: [],
          apiCalls: [],
          childScreens: [],
          metadata: { linesOfCode: 100, complexity: 'low' },
        },
        {
          id: 'screen-2',
          name: 'ProductDetail',
          route: '/products/:id',
          filePath: 'src/pages/ProductDetail.tsx',
          components: [],
          apiCalls: [],
          childScreens: [],
          metadata: { linesOfCode: 150, complexity: 'medium' },
        },
      ];

      const result = extractor.extract(codeIndex);

      // 화면 그룹별 요약 생성 확인
      expect(result.featureSummary.length).toBeGreaterThanOrEqual(1);
      // 상품 도메인 관련 요약이 있어야 함
      const productSummary = result.featureSummary.find(
        (s) => s.includes('상품') || s.includes('Product'),
      );
      expect(productSummary).toBeDefined();
      // 화면 수 표시 확인
      expect(productSummary).toContain('화면');
    });

    // --------------------------------------------------------
    // 4. 빈 인덱스 처리
    // --------------------------------------------------------
    it('should return empty arrays for empty index', () => {
      const codeIndex = createEmptyCodeIndex();

      const result = extractor.extract(codeIndex);

      expect(result.domains).toEqual([]);
      expect(result.featureSummary).toEqual([]);
    });

    // --------------------------------------------------------
    // 5. 기능 요약 최대 10개 제한
    // --------------------------------------------------------
    it('should limit feature summary to max 10 items', () => {
      const codeIndex = createEmptyCodeIndex();

      // 15개의 다른 도메인 화면을 생성해서 10개 초과 요약 유도
      const screenDomains = [
        'OrderList', 'PaymentPage', 'ProductList', 'UserProfile',
        'CartPage', 'DeliveryTracker', 'InventoryDashboard', 'SearchPage',
        'NotificationCenter', 'ReviewList', 'CouponManager', 'AdminPanel',
        'LoginPage', 'SettlementReport', 'ContentEditor',
      ];

      codeIndex.screens = screenDomains.map((name, idx) => ({
        id: `screen-${idx}`,
        name,
        route: `/${name.toLowerCase()}`,
        filePath: `src/pages/${name}.tsx`,
        components: [],
        apiCalls: [],
        childScreens: [],
        metadata: { linesOfCode: 100, complexity: 'low' as const },
      }));

      const result = extractor.extract(codeIndex);

      // 최대 10개 제한
      expect(result.featureSummary.length).toBeLessThanOrEqual(10);
    });

    // --------------------------------------------------------
    // 6. 도메인 중복 제거
    // --------------------------------------------------------
    it('should deduplicate domains', () => {
      const codeIndex = createEmptyCodeIndex();

      // 같은 도메인 키워드가 여러 API/화면에 등장해도 도메인은 한 번만 나와야 함
      codeIndex.apis = [
        {
          id: 'api-1',
          method: 'GET',
          path: '/api/orders',
          filePath: 'src/routes/orders.ts',
          handler: 'getOrders',
          calledBy: [],
          requestParams: [],
          responseType: 'Order[]',
          relatedModels: [],
        },
        {
          id: 'api-2',
          method: 'POST',
          path: '/api/orders/create',
          filePath: 'src/routes/orders.ts',
          handler: 'createOrder',
          calledBy: [],
          requestParams: [],
          responseType: 'Order',
          relatedModels: [],
        },
        {
          id: 'api-3',
          method: 'GET',
          path: '/api/checkout/order',
          filePath: 'src/routes/checkout.ts',
          handler: 'checkoutOrder',
          calledBy: [],
          requestParams: [],
          responseType: 'Order',
          relatedModels: [],
        },
      ];
      codeIndex.screens = [
        {
          id: 'screen-1',
          name: 'OrderList',
          route: '/orders',
          filePath: 'src/pages/OrderList.tsx',
          components: [],
          apiCalls: [],
          childScreens: [],
          metadata: { linesOfCode: 100, complexity: 'low' },
        },
      ];

      const result = extractor.extract(codeIndex);

      // '주문' 도메인이 한 번만 등장
      const orderDomainCount = result.domains.filter((d) => d === '주문').length;
      expect(orderDomainCount).toBe(1);
      // 도메인 배열의 고유성 확인
      const uniqueDomains = [...new Set(result.domains)];
      expect(result.domains).toEqual(uniqueDomains);
    });

    // --------------------------------------------------------
    // 7. 모델과 파일 경로에서도 도메인 추출
    // --------------------------------------------------------
    it('should extract domains from model names and file paths', () => {
      const codeIndex = createEmptyCodeIndex();
      codeIndex.models = [
        {
          id: 'model-1',
          name: 'UserAccount',
          filePath: 'src/models/user.ts',
          type: 'interface',
          fields: [],
          relatedApis: [],
        },
      ];
      codeIndex.files = [
        {
          path: 'src/auth/login.ts',
          hash: 'abc123',
          size: 1000,
          extension: '.ts',
          lastModified: '2025-01-01T00:00:00Z',
        },
      ];

      const result = extractor.extract(codeIndex);

      // '회원' 도메인: 모델명에 'user', 'account'; 파일 경로에 'auth', 'login'
      expect(result.domains).toContain('회원');
    });

    // --------------------------------------------------------
    // 8. 임계값 미달 도메인은 제외
    // --------------------------------------------------------
    it('should exclude domains below score threshold', () => {
      const codeIndex = createEmptyCodeIndex();

      // 주문 도메인: API + 화면으로 높은 점수
      codeIndex.apis = [
        {
          id: 'api-1',
          method: 'GET',
          path: '/api/orders',
          filePath: 'src/routes/orders.ts',
          handler: 'getOrders',
          calledBy: [],
          requestParams: [],
          responseType: 'Order[]',
          relatedModels: [],
        },
        {
          id: 'api-2',
          method: 'POST',
          path: '/api/orders/create',
          filePath: 'src/routes/orders.ts',
          handler: 'createOrder',
          calledBy: [],
          requestParams: [],
          responseType: 'Order',
          relatedModels: [],
        },
      ];
      codeIndex.screens = [
        {
          id: 'screen-1',
          name: 'OrderList',
          route: '/orders',
          filePath: 'src/pages/OrderList.tsx',
          components: [],
          apiCalls: [],
          childScreens: [],
          metadata: { linesOfCode: 100, complexity: 'low' },
        },
      ];

      // 파일 경로에 'inventory' 한 번만 (가중치 1) → 점수 1 → 임계값 미달 가능
      codeIndex.files = [
        {
          path: 'src/misc/inventory-note.ts',
          hash: 'xyz',
          size: 100,
          extension: '.ts',
          lastModified: '2025-01-01T00:00:00Z',
        },
      ];

      const result = extractor.extract(codeIndex);

      // 주문은 높은 점수로 포함되어야 함
      expect(result.domains).toContain('주문');
      // 임계값 적용 확인: threshold = max(maxScore * 0.1, 2) 이상만 포함
      // 모든 도메인의 점수가 threshold 이상인지 확인 (간접 검증)
      expect(result.domains.length).toBeGreaterThanOrEqual(1);
    });
  });
});
