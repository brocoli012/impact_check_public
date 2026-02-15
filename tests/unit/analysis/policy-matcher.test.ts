/**
 * @module tests/unit/analysis/policy-matcher
 * @description PolicyMatcher 단위 테스트
 */

import { PolicyMatcher } from '../../../src/core/analysis/policy-matcher';
import { ImpactResult } from '../../../src/types/analysis';
import { PolicyInfo } from '../../../src/types/index';

/** 테스트용 ImpactResult 생성 */
function createTestImpact(): ImpactResult {
  return {
    analysisId: 'test-analysis',
    analyzedAt: new Date().toISOString(),
    specTitle: '테스트 기획서',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: 'CartPage',
        impactLevel: 'medium',
        tasks: [
          {
            id: 'T-001',
            title: '장바구니 수정',
            type: 'FE',
            actionType: 'modify',
            description: '장바구니 수량 변경',
            affectedFiles: ['src/pages/CartPage.tsx', 'src/components/CartItem.tsx'],
            relatedApis: ['api-1'],
            planningChecks: [],
            rationale: '',
          },
        ],
      },
    ],
    analysisMethod: 'rule-based' as const,
    tasks: [
      {
        id: 'T-001',
        title: '장바구니 수정',
        type: 'FE',
        actionType: 'modify',
        description: '장바구니 수량 변경',
        affectedFiles: ['src/pages/CartPage.tsx', 'src/components/CartItem.tsx'],
        relatedApis: ['api-1'],
        planningChecks: [],
        rationale: '',
      },
      {
        id: 'T-002',
        title: 'API 수정',
        type: 'BE',
        actionType: 'modify',
        description: 'Cart API 수정',
        affectedFiles: ['src/api/cart.ts'],
        relatedApis: ['api-1'],
        planningChecks: [],
        rationale: '',
      },
    ],
    planningChecks: [],
    policyChanges: [],
  };
}

/** 테스트용 정책 목록 생성 */
function createTestPolicies(): PolicyInfo[] {
  return [
    {
      id: 'policy-1',
      name: '장바구니 수량 제한',
      description: '상품 수량은 1~99 범위',
      source: 'comment',
      sourceText: '// 수량 제한: 1~99',
      filePath: 'src/components/CartItem.tsx',
      lineNumber: 25,
      category: '장바구니',
      relatedComponents: ['comp-1'],
      relatedApis: ['api-1'],
      relatedModules: ['cart'],
      extractedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'policy-2',
      name: '결제 금액 최소 제한',
      description: '최소 주문 금액 10,000원',
      source: 'comment',
      sourceText: '// 최소 주문 금액: 10000',
      filePath: 'src/services/payment.ts',
      lineNumber: 42,
      category: '결제',
      relatedComponents: [],
      relatedApis: ['api-5'],
      relatedModules: ['payment'],
      extractedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'policy-3',
      name: '인증 필수',
      description: '주문 시 로그인 필수',
      source: 'manual',
      sourceText: '',
      filePath: 'src/middleware/auth.ts',
      lineNumber: 10,
      category: '보안',
      relatedComponents: [],
      relatedApis: [],
      relatedModules: ['auth'],
      extractedAt: '2024-01-01T00:00:00Z',
    },
  ];
}

describe('PolicyMatcher', () => {
  let policyMatcher: PolicyMatcher;

  beforeEach(() => {
    policyMatcher = new PolicyMatcher();
  });

  describe('match', () => {
    it('should match policies by affected file path', () => {
      const impact = createTestImpact();
      const policies = createTestPolicies();

      const warnings = policyMatcher.match(impact, policies);

      // policy-1은 CartItem.tsx에 있으므로 매칭되어야 함
      const cartWarning = warnings.find(w => w.policyId === 'policy-1');
      expect(cartWarning).toBeDefined();
      expect(cartWarning!.policyName).toBe('장바구니 수량 제한');
    });

    it('should match policies by related API', () => {
      const impact = createTestImpact();
      const policies = createTestPolicies();

      const warnings = policyMatcher.match(impact, policies);

      // policy-1은 api-1과 관련이 있으므로 매칭
      const apiWarning = warnings.find(w =>
        w.policyId === 'policy-1' && w.relatedTaskIds.length > 0
      );
      expect(apiWarning).toBeDefined();
    });

    it('should not match unrelated policies', () => {
      const impact = createTestImpact();
      const policies = createTestPolicies();

      const warnings = policyMatcher.match(impact, policies);

      // policy-2 (결제)는 영향 파일과 관련 없음
      const paymentWarning = warnings.find(w => w.policyId === 'policy-2');
      expect(paymentWarning).toBeUndefined();
    });

    it('should match policies by module name', () => {
      const impact = createTestImpact();
      // cart 모듈과 관련된 정책은 'src/api/cart.ts' 파일과 매칭
      const policies: PolicyInfo[] = [
        {
          id: 'policy-cart',
          name: 'Cart 모듈 정책',
          description: 'cart 관련 정책',
          source: 'manual',
          sourceText: '',
          filePath: 'src/config/cart-policy.ts',
          lineNumber: 1,
          category: '장바구니',
          relatedComponents: [],
          relatedApis: [],
          relatedModules: ['cart'],
          extractedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const warnings = policyMatcher.match(impact, policies);
      // 'cart' 모듈이 영향 파일 'src/api/cart.ts'에 포함되므로 매칭
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should assign correct severity for critical categories', () => {
      const impact = createTestImpact();
      // 보안 카테고리 정책이 직접 영향 받는 파일과 매칭되도록 설정
      const policies: PolicyInfo[] = [
        {
          id: 'policy-security',
          name: '보안 인증 정책',
          description: '인증 필수',
          source: 'manual',
          sourceText: '',
          filePath: 'src/pages/CartPage.tsx', // 직접 영향 받는 파일
          lineNumber: 1,
          category: '보안',
          relatedComponents: [],
          relatedApis: [],
          relatedModules: [],
          extractedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const warnings = policyMatcher.match(impact, policies);
      const securityWarning = warnings.find(w => w.policyId === 'policy-security');
      expect(securityWarning).toBeDefined();
      expect(securityWarning!.severity).toBe('critical');
    });

    it('should return empty array when no policies match', () => {
      const impact = createTestImpact();
      const policies: PolicyInfo[] = [];

      const warnings = policyMatcher.match(impact, policies);
      expect(warnings).toHaveLength(0);
    });

    it('should include related task IDs in warnings', () => {
      const impact = createTestImpact();
      const policies = createTestPolicies();

      const warnings = policyMatcher.match(impact, policies);
      const cartWarning = warnings.find(w => w.policyId === 'policy-1');

      if (cartWarning) {
        expect(cartWarning.relatedTaskIds.length).toBeGreaterThan(0);
      }
    });

    it('should generate proper warning IDs', () => {
      const impact = createTestImpact();
      const policies = createTestPolicies();

      const warnings = policyMatcher.match(impact, policies);

      for (const warning of warnings) {
        expect(warning.id).toMatch(/^PW-\d{3}$/);
      }
    });
  });
});
