"use strict";
/**
 * @module commands/demo
 * @description Demo 명령어 핸들러 - 샘플 데이터 기반으로 도구를 체험
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoCommand = void 0;
const common_1 = require("../types/common");
const result_manager_1 = require("../core/analysis/result-manager");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/** 데모용 샘플 분석 결과 */
function createDemoResult() {
    const now = new Date().toISOString();
    return {
        analysisId: 'demo-analysis-001',
        analyzedAt: now,
        specTitle: '[데모] 장바구니 쿠폰 적용 기능 기획서',
        analysisMethod: 'rule-based',
        affectedScreens: [
            {
                screenId: 'screen-cart',
                screenName: '장바구니',
                impactLevel: 'high',
                tasks: [
                    {
                        id: 'T-001',
                        title: '쿠폰 적용 UI 개발',
                        type: 'FE',
                        actionType: 'new',
                        description: '장바구니 화면에 쿠폰 입력 및 적용 UI 추가',
                        affectedFiles: ['src/pages/CartPage.tsx', 'src/components/CouponInput.tsx'],
                        relatedApis: ['api-coupon-apply'],
                        planningChecks: ['쿠폰 중복 적용 가능 여부 확인', '할인 금액 표시 위치 결정'],
                        rationale: '신규 쿠폰 적용 UI 컴포넌트 개발 및 장바구니 페이지 연동이 필요합니다.',
                    },
                    {
                        id: 'T-002',
                        title: '쿠폰 적용 API 연동',
                        type: 'BE',
                        actionType: 'new',
                        description: '쿠폰 적용 API 엔드포인트 구현',
                        affectedFiles: ['src/api/coupon.ts', 'src/models/coupon.ts'],
                        relatedApis: [],
                        planningChecks: ['쿠폰 유효기간 검증 로직', '최대 할인 금액 제한'],
                        rationale: '/api/cart/coupon POST 엔드포인트 및 쿠폰 검증 로직 구현이 필요합니다.',
                    },
                ],
            },
            {
                screenId: 'screen-checkout',
                screenName: '결제',
                impactLevel: 'medium',
                tasks: [
                    {
                        id: 'T-003',
                        title: '결제 금액 할인 반영',
                        type: 'FE',
                        actionType: 'modify',
                        description: '결제 화면에서 쿠폰 할인 금액 표시',
                        affectedFiles: ['src/pages/CheckoutPage.tsx'],
                        relatedApis: ['api-checkout'],
                        planningChecks: ['할인 금액 0원일 때 표시 방식'],
                        rationale: '결제 화면에서 쿠폰 할인이 적용된 최종 금액을 표시해야 합니다.',
                    },
                ],
            },
        ],
        tasks: [
            {
                id: 'T-001',
                title: '쿠폰 적용 UI 개발',
                type: 'FE',
                actionType: 'new',
                description: '장바구니 화면에 쿠폰 입력 및 적용 UI 추가',
                affectedFiles: ['src/pages/CartPage.tsx', 'src/components/CouponInput.tsx'],
                relatedApis: ['api-coupon-apply'],
                planningChecks: ['쿠폰 중복 적용 가능 여부 확인', '할인 금액 표시 위치 결정'],
                rationale: '신규 쿠폰 적용 UI 컴포넌트 개발 및 장바구니 페이지 연동이 필요합니다.',
            },
            {
                id: 'T-002',
                title: '쿠폰 적용 API 연동',
                type: 'BE',
                actionType: 'new',
                description: '쿠폰 적용 API 엔드포인트 구현',
                affectedFiles: ['src/api/coupon.ts', 'src/models/coupon.ts'],
                relatedApis: [],
                planningChecks: ['쿠폰 유효기간 검증 로직', '최대 할인 금액 제한'],
                rationale: '/api/cart/coupon POST 엔드포인트 및 쿠폰 검증 로직 구현이 필요합니다.',
            },
            {
                id: 'T-003',
                title: '결제 금액 할인 반영',
                type: 'FE',
                actionType: 'modify',
                description: '결제 화면에서 쿠폰 할인 금액 표시',
                affectedFiles: ['src/pages/CheckoutPage.tsx'],
                relatedApis: ['api-checkout'],
                planningChecks: ['할인 금액 0원일 때 표시 방식'],
                rationale: '결제 화면에서 쿠폰 할인이 적용된 최종 금액을 표시해야 합니다.',
            },
        ],
        planningChecks: [
            {
                id: 'CHK-001',
                content: '쿠폰 중복 적용 가능 여부 확인',
                relatedFeatureId: 'F-001',
                priority: 'high',
                status: 'pending',
            },
            {
                id: 'CHK-002',
                content: '할인 금액 표시 위치 결정',
                relatedFeatureId: 'F-001',
                priority: 'medium',
                status: 'pending',
            },
        ],
        policyChanges: [
            {
                id: 'PC-001',
                policyName: '쿠폰 할인 정책',
                description: '최대 할인 금액 제한 규칙 신규 추가',
                changeType: 'new',
                affectedFiles: ['src/policies/coupon-policy.ts'],
                requiresReview: true,
            },
        ],
        screenScores: [
            {
                screenId: 'screen-cart',
                screenName: '장바구니',
                screenScore: 6.5,
                grade: 'High',
                taskScores: [
                    {
                        taskId: 'T-001',
                        scores: {
                            developmentComplexity: { score: 6, weight: 0.35, rationale: '신규 UI 컴포넌트 개발' },
                            impactScope: { score: 7, weight: 0.30, rationale: '장바구니 핵심 기능' },
                            policyChange: { score: 5, weight: 0.20, rationale: '쿠폰 정책 추가' },
                            dependencyRisk: { score: 6, weight: 0.15, rationale: 'API 의존성' },
                        },
                        totalScore: 6.2,
                        grade: 'High',
                    },
                    {
                        taskId: 'T-002',
                        scores: {
                            developmentComplexity: { score: 7, weight: 0.35, rationale: 'API 및 검증 로직' },
                            impactScope: { score: 6, weight: 0.30, rationale: '결제 시스템 연동' },
                            policyChange: { score: 7, weight: 0.20, rationale: '신규 정책 구현' },
                            dependencyRisk: { score: 5, weight: 0.15, rationale: 'DB 스키마 변경' },
                        },
                        totalScore: 6.5,
                        grade: 'High',
                    },
                ],
            },
            {
                screenId: 'screen-checkout',
                screenName: '결제',
                screenScore: 4.0,
                grade: 'Medium',
                taskScores: [
                    {
                        taskId: 'T-003',
                        scores: {
                            developmentComplexity: { score: 4, weight: 0.35, rationale: '기존 화면 수정' },
                            impactScope: { score: 5, weight: 0.30, rationale: '결제 화면 영향' },
                            policyChange: { score: 3, weight: 0.20, rationale: '정책 변경 없음' },
                            dependencyRisk: { score: 3, weight: 0.15, rationale: '단순 데이터 표시' },
                        },
                        totalScore: 4.0,
                        grade: 'Medium',
                    },
                ],
            },
        ],
        totalScore: 35.5,
        grade: 'Medium',
        recommendation: '스프린트 계획 시 우선순위 조정이 필요합니다.',
        policyWarnings: [
            {
                id: 'PW-001',
                policyId: 'pol-coupon',
                policyName: '쿠폰 할인 정책',
                message: '최대 할인 금액 제한 규칙이 새로 추가됩니다. 기존 쿠폰과의 호환성을 확인하세요.',
                severity: 'warning',
                relatedTaskIds: ['T-001', 'T-002'],
            },
        ],
        ownerNotifications: [
            {
                id: 'ON-001',
                systemId: 'cart-system',
                systemName: '장바구니 시스템',
                team: '커머스팀',
                ownerName: '김개발',
                ownerEmail: 'dev.kim@kurly.com',
                relatedTaskIds: ['T-001', 'T-002'],
                emailDraft: '장바구니 쿠폰 적용 기능 개발 관련 영향도 분석 결과를 공유드립니다.',
            },
        ],
        confidenceScores: [
            {
                systemId: 'cart-system',
                systemName: '장바구니 시스템',
                overallScore: 72,
                grade: 'medium',
                layers: {
                    layer1Structure: { score: 80, weight: 0.25, details: '구조 분석 완료' },
                    layer2Dependency: { score: 75, weight: 0.25, details: '의존성 그래프 분석 완료' },
                    layer3Policy: { score: 60, weight: 0.20, details: '정책 매칭 완료' },
                    layer4LLM: { score: 70, weight: 0.30, details: '규칙 기반 분석' },
                },
                warnings: ['보강 주석 미적용'],
                recommendations: ['보강 주석을 추가하면 신뢰도가 향상됩니다.'],
            },
        ],
        lowConfidenceWarnings: [],
    };
}
/**
 * DemoCommand - 데모 체험 명령어
 *
 * 사용법: /impact demo [--no-open]
 * 기능:
 *   - 샘플 분석 결과 생성
 *   - 단계별 데모 워크스루 출력
 *   - 시각화 웹 열기 (--no-open으로 생략 가능)
 */
class DemoCommand {
    constructor(args) {
        this.name = 'demo';
        this.description = '샘플 데이터 기반으로 도구를 체험합니다.';
        this.args = args;
    }
    async execute() {
        const noOpen = this.args.includes('--no-open');
        try {
            logger_1.logger.header('Impact Checker - Demo');
            console.log('');
            // Step 1: 프로젝트 초기화 시뮬레이션
            console.log('  [1/5] 프로젝트 초기화...');
            await this.delay(300);
            console.log('        sample-kurly-app 프로젝트 등록 완료');
            // Step 2: 기획서 파싱 시뮬레이션
            console.log('  [2/5] 기획서 파싱...');
            await this.delay(300);
            console.log('        "장바구니 쿠폰 적용 기능" 파싱 완료');
            // Step 3: 영향도 분석 시뮬레이션
            console.log('  [3/5] 영향도 분석...');
            await this.delay(300);
            console.log('        2개 화면, 3개 작업 식별');
            // Step 4: 결과 저장
            console.log('  [4/5] 결과 저장 완료!');
            const demoResult = createDemoResult();
            const demoProjectId = 'demo-project';
            const demoDir = (0, file_1.getProjectDir)(demoProjectId);
            (0, file_1.ensureDir)(demoDir);
            const resultManager = new result_manager_1.ResultManager();
            await resultManager.save(demoResult, demoProjectId, demoResult.specTitle);
            // Step 5: 안내
            console.log('  [5/5] 데모 준비 완료!');
            console.log('');
            // 결과 요약
            logger_1.logger.separator();
            console.log('');
            console.log('  데모 분석 결과 요약:');
            console.log('  ─────────────────────────────────');
            console.log(`  기획서: ${demoResult.specTitle}`);
            console.log(`  총점: ${demoResult.totalScore.toFixed(1)}`);
            console.log(`  등급: ${demoResult.grade}`);
            console.log(`  영향 화면: ${demoResult.affectedScreens.length}개`);
            console.log(`  작업 수: ${demoResult.tasks.length}개`);
            console.log(`  정책 경고: ${demoResult.policyWarnings.length}개`);
            console.log('  ─────────────────────────────────');
            console.log('');
            if (!noOpen) {
                console.log('  시각화 웹에서 결과를 확인하세요:');
                console.log('  /impact view 명령어로 웹 서버를 시작하세요.');
            }
            console.log('');
            logger_1.logger.success('데모가 완료되었습니다!');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'Demo completed successfully.',
                data: {
                    projectId: demoProjectId,
                    analysisId: demoResult.analysisId,
                },
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`데모 실행 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Demo failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 시뮬레이션 딜레이
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.DemoCommand = DemoCommand;
//# sourceMappingURL=demo.js.map