/**
 * @module web/utils/mockData
 * @description 모의 데이터 - 실제 분석 결과가 없을 때 대시보드에 표시할 데모 데이터
 */

import type { AnalysisResult, ResultSummary } from '../types';

/**
 * 모의 분석 결과를 반환
 */
export function getMockResult(): AnalysisResult {
  return {
    analysisId: 'demo-analysis-001',
    analyzedAt: new Date().toISOString(),
    specTitle: '[데모] 장바구니 리뉴얼 기획서',
    analysisMethod: 'rule-based',
    affectedScreens: [
      {
        screenId: 'screen-cart',
        screenName: '장바구니 화면',
        impactLevel: 'high',
        tasks: [
          {
            id: 'task-1',
            title: '장바구니 UI 전면 개편',
            type: 'FE',
            actionType: 'modify',
            description: '장바구니 화면의 레이아웃 및 UX를 전면 개편합니다.',
            affectedFiles: ['src/pages/Cart.tsx', 'src/components/CartItem.tsx'],
            relatedApis: ['api-cart-list'],
            planningChecks: ['묶음 배송 정책 확인 필요'],
            rationale: '기존 장바구니 UI 구조 변경이 필요합니다.',
          },
          {
            id: 'task-2',
            title: '장바구니 API 응답 변경',
            type: 'BE',
            actionType: 'modify',
            description: '장바구니 조회 API의 응답 필드를 추가합니다.',
            affectedFiles: ['src/api/cart.ts'],
            relatedApis: ['api-cart-list'],
            planningChecks: [],
            rationale: '새로운 UI에 필요한 데이터 필드가 추가되어야 합니다.',
          },
        ],
      },
      {
        screenId: 'screen-checkout',
        screenName: '결제 화면',
        impactLevel: 'medium',
        tasks: [
          {
            id: 'task-3',
            title: '결제 화면 장바구니 연동 수정',
            type: 'FE',
            actionType: 'modify',
            description: '장바구니 데이터 구조 변경에 따른 결제 화면 수정',
            affectedFiles: ['src/pages/Checkout.tsx'],
            relatedApis: ['api-checkout'],
            planningChecks: ['결제 수단별 분기 확인 필요'],
            rationale: '장바구니 데이터 구조 변경에 따라 결제 화면도 수정이 필요합니다.',
          },
        ],
      },
      {
        screenId: 'screen-product',
        screenName: '상품 상세 화면',
        impactLevel: 'low',
        tasks: [
          {
            id: 'task-4',
            title: '장바구니 담기 버튼 수정',
            type: 'FE',
            actionType: 'modify',
            description: '장바구니 담기 기능의 인터페이스 변경',
            affectedFiles: ['src/pages/ProductDetail.tsx'],
            relatedApis: ['api-cart-add'],
            planningChecks: [],
            rationale: '새로운 장바구니 API에 맞게 인터페이스를 수정합니다.',
          },
        ],
      },
      {
        screenId: 'screen-mypage',
        screenName: '마이페이지',
        impactLevel: 'low',
        tasks: [
          {
            id: 'task-5',
            title: '최근 주문 위젯 업데이트',
            type: 'FE',
            actionType: 'modify',
            description: '마이페이지의 최근 주문 위젯에 새 데이터 필드 반영',
            affectedFiles: ['src/pages/MyPage.tsx'],
            relatedApis: ['api-orders'],
            planningChecks: [],
            rationale: '새 데이터 필드를 위젯에 반영합니다.',
          },
          {
            id: 'task-6',
            title: '주문 이력 API 확장',
            type: 'BE',
            actionType: 'modify',
            description: '주문 이력 API에 장바구니 관련 메타데이터 추가',
            affectedFiles: ['src/api/orders.ts'],
            relatedApis: ['api-orders'],
            planningChecks: [],
            rationale: 'API 응답에 새 필드를 추가합니다.',
          },
        ],
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: '장바구니 UI 전면 개편',
        type: 'FE',
        actionType: 'modify',
        description: '장바구니 화면의 레이아웃 및 UX를 전면 개편합니다.',
        affectedFiles: ['src/pages/Cart.tsx', 'src/components/CartItem.tsx'],
        relatedApis: ['api-cart-list'],
        planningChecks: ['묶음 배송 정책 확인 필요'],
        rationale: '기존 장바구니 UI 구조 변경이 필요합니다.',
      },
      {
        id: 'task-2',
        title: '장바구니 API 응답 변경',
        type: 'BE',
        actionType: 'modify',
        description: '장바구니 조회 API의 응답 필드를 추가합니다.',
        affectedFiles: ['src/api/cart.ts'],
        relatedApis: ['api-cart-list'],
        planningChecks: [],
        rationale: '새로운 UI에 필요한 데이터 필드가 추가되어야 합니다.',
      },
      {
        id: 'task-3',
        title: '결제 화면 장바구니 연동 수정',
        type: 'FE',
        actionType: 'modify',
        description: '장바구니 데이터 구조 변경에 따른 결제 화면 수정',
        affectedFiles: ['src/pages/Checkout.tsx'],
        relatedApis: ['api-checkout'],
        planningChecks: ['결제 수단별 분기 확인 필요'],
        rationale: '장바구니 데이터 구조 변경에 따라 결제 화면도 수정이 필요합니다.',
      },
      {
        id: 'task-4',
        title: '장바구니 담기 버튼 수정',
        type: 'FE',
        actionType: 'modify',
        description: '장바구니 담기 기능의 인터페이스 변경',
        affectedFiles: ['src/pages/ProductDetail.tsx'],
        relatedApis: ['api-cart-add'],
        planningChecks: [],
        rationale: '새로운 장바구니 API에 맞게 인터페이스를 수정합니다.',
      },
      {
        id: 'task-5',
        title: '최근 주문 위젯 업데이트',
        type: 'FE',
        actionType: 'modify',
        description: '마이페이지의 최근 주문 위젯에 새 데이터 필드 반영',
        affectedFiles: ['src/pages/MyPage.tsx'],
        relatedApis: ['api-orders'],
        planningChecks: [],
        rationale: '새 데이터 필드를 위젯에 반영합니다.',
      },
      {
        id: 'task-6',
        title: '주문 이력 API 확장',
        type: 'BE',
        actionType: 'modify',
        description: '주문 이력 API에 장바구니 관련 메타데이터 추가',
        affectedFiles: ['src/api/orders.ts'],
        relatedApis: ['api-orders'],
        planningChecks: [],
        rationale: 'API 응답에 새 필드를 추가합니다.',
      },
    ],
    planningChecks: [
      {
        id: 'check-1',
        content: '묶음 배송 정책에 대한 기획 확인이 필요합니다.',
        relatedFeatureId: 'feat-cart',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'check-2',
        content: '결제 수단별 분기 처리 정책 확인이 필요합니다.',
        relatedFeatureId: 'feat-checkout',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: 'check-3',
        content: '장바구니 최대 수량 제한 정책 확인이 필요합니다.',
        relatedFeatureId: 'feat-cart',
        priority: 'low',
        status: 'pending',
      },
      {
        id: 'check-4',
        content: '기존 장바구니 사용자 데이터 마이그레이션 확인이 필요합니다.',
        relatedFeatureId: 'feat-cart',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'check-5',
        content: 'UI 디자인 시안 리뷰 및 디자이너 확인이 필요합니다.',
        relatedFeatureId: 'feat-cart',
        priority: 'medium',
        status: 'pending',
      },
    ],
    policyChanges: [
      {
        id: 'policy-1',
        policyName: '장바구니 수량 제한',
        description: '장바구니 최대 담기 수량이 30개에서 50개로 변경됩니다.',
        changeType: 'modify',
        affectedFiles: ['src/constants/cart.ts'],
        requiresReview: true,
      },
    ],
    screenScores: [
      {
        screenId: 'screen-cart',
        screenName: '장바구니 화면',
        screenScore: 45,
        grade: 'High',
        taskScores: [
          {
            taskId: 'task-1',
            scores: {
              developmentComplexity: { score: 7, weight: 0.35, rationale: 'UI 전면 개편' },
              impactScope: { score: 6, weight: 0.30, rationale: '여러 컴포넌트 영향' },
              policyChange: { score: 4, weight: 0.20, rationale: '정책 변경 포함' },
              dependencyRisk: { score: 5, weight: 0.15, rationale: 'API 의존성' },
            },
            totalScore: 28,
            grade: 'Medium',
          },
          {
            taskId: 'task-2',
            scores: {
              developmentComplexity: { score: 5, weight: 0.35, rationale: 'API 필드 추가' },
              impactScope: { score: 4, weight: 0.30, rationale: 'API 호출 변경' },
              policyChange: { score: 3, weight: 0.20, rationale: '응답 스키마 변경' },
              dependencyRisk: { score: 3, weight: 0.15, rationale: '하위 호환성' },
            },
            totalScore: 17,
            grade: 'Medium',
          },
        ],
      },
      {
        screenId: 'screen-checkout',
        screenName: '결제 화면',
        screenScore: 25,
        grade: 'Medium',
        taskScores: [
          {
            taskId: 'task-3',
            scores: {
              developmentComplexity: { score: 5, weight: 0.35, rationale: '연동 수정' },
              impactScope: { score: 4, weight: 0.30, rationale: '결제 플로우' },
              policyChange: { score: 3, weight: 0.20, rationale: '결제 정책' },
              dependencyRisk: { score: 4, weight: 0.15, rationale: 'PG 의존성' },
            },
            totalScore: 25,
            grade: 'Medium',
          },
        ],
      },
      {
        screenId: 'screen-product',
        screenName: '상품 상세 화면',
        screenScore: 8,
        grade: 'Low',
        taskScores: [
          {
            taskId: 'task-4',
            scores: {
              developmentComplexity: { score: 2, weight: 0.35, rationale: '버튼 수정' },
              impactScope: { score: 2, weight: 0.30, rationale: '단일 컴포넌트' },
              policyChange: { score: 1, weight: 0.20, rationale: '정책 변경 없음' },
              dependencyRisk: { score: 2, weight: 0.15, rationale: '낮은 의존성' },
            },
            totalScore: 8,
            grade: 'Low',
          },
        ],
      },
      {
        screenId: 'screen-mypage',
        screenName: '마이페이지',
        screenScore: 12,
        grade: 'Low',
        taskScores: [
          {
            taskId: 'task-5',
            scores: {
              developmentComplexity: { score: 2, weight: 0.35, rationale: '위젯 업데이트' },
              impactScope: { score: 2, weight: 0.30, rationale: '단일 위젯' },
              policyChange: { score: 1, weight: 0.20, rationale: '없음' },
              dependencyRisk: { score: 1, weight: 0.15, rationale: '낮음' },
            },
            totalScore: 6,
            grade: 'Low',
          },
          {
            taskId: 'task-6',
            scores: {
              developmentComplexity: { score: 2, weight: 0.35, rationale: 'API 확장' },
              impactScope: { score: 2, weight: 0.30, rationale: '단일 API' },
              policyChange: { score: 1, weight: 0.20, rationale: '없음' },
              dependencyRisk: { score: 1, weight: 0.15, rationale: '낮음' },
            },
            totalScore: 6,
            grade: 'Low',
          },
        ],
      },
    ],
    totalScore: 45,
    grade: 'High',
    recommendation: '별도 프로젝트 계획이 필요합니다. 리소스 배분을 검토하세요.',
    policyWarnings: [
      {
        id: 'pw-1',
        policyId: 'policy-cart-limit',
        policyName: '장바구니 수량 제한',
        message: '장바구니 수량 제한 정책이 변경됩니다. 기존 로직 검토가 필요합니다.',
        severity: 'warning',
        relatedTaskIds: ['task-1', 'task-2'],
      },
    ],
    ownerNotifications: [
      {
        id: 'on-1',
        systemId: 'sys-cart',
        systemName: '장바구니 시스템',
        team: '커머스팀',
        ownerName: '김개발',
        ownerEmail: 'dev.kim@kurly.com',
        slackChannel: '#cart-team',
        relatedTaskIds: ['task-1', 'task-2'],
        emailDraft: '장바구니 리뉴얼 관련 영향 분석 결과를 공유드립니다.',
      },
      {
        id: 'on-2',
        systemId: 'sys-checkout',
        systemName: '결제 시스템',
        team: '페이먼트팀',
        ownerName: '이결제',
        ownerEmail: 'payment.lee@kurly.com',
        slackChannel: '#payment-team',
        relatedTaskIds: ['task-3'],
        emailDraft: '결제 화면 수정 관련 영향 분석 결과를 공유드립니다.',
      },
      {
        id: 'on-3',
        systemId: 'sys-order',
        systemName: '주문 시스템',
        team: '주문팀',
        ownerName: '박주문',
        ownerEmail: 'order.park@kurly.com',
        slackChannel: '#order-team',
        relatedTaskIds: ['task-5', 'task-6'],
        emailDraft: '주문 이력 API 확장 관련 영향 분석 결과를 공유드립니다.',
      },
    ],
    confidenceScores: [
      {
        systemId: 'sys-cart',
        systemName: '장바구니 시스템',
        overallScore: 0.82,
        grade: 'high',
        warnings: [],
        recommendations: ['코드 커버리지 분석으로 추가 검증 권장'],
      },
      {
        systemId: 'sys-checkout',
        systemName: '결제 시스템',
        overallScore: 0.65,
        grade: 'medium',
        warnings: ['PG 연동 부분의 영향 범위가 불확실합니다.'],
        recommendations: ['PG 담당자 확인 필요', '스테이징 환경에서 테스트 권장'],
      },
      {
        systemId: 'sys-order',
        systemName: '주문 시스템',
        overallScore: 0.45,
        grade: 'low',
        warnings: ['주문 이력 데이터 구조 파악이 불완전합니다.'],
        recommendations: ['주문팀 담당자 리뷰 필수', 'DB 스키마 확인 필요'],
      },
    ],
    lowConfidenceWarnings: [
      {
        systemId: 'sys-order',
        systemName: '주문 시스템',
        confidenceScore: 0.45,
        grade: 'low',
        reason: '주문 이력 데이터 구조 파악이 불완전합니다.',
        action: '주문팀 담당자 리뷰 필수',
      },
    ],
  };
}

/**
 * 모의 분석 결과의 요약 정보를 반환 (LNB용)
 */
export function getMockResultSummary(): ResultSummary {
  return {
    id: 'demo-analysis-001',
    specTitle: '장바구니 리뉴얼 기획서',
    analyzedAt: new Date().toISOString(),
    totalScore: 45,
    grade: 'High',
    affectedScreenCount: 4,
    taskCount: 6,
    isDemo: true,
  };
}
