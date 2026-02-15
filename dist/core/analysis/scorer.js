"use strict";
/**
 * @module core/analysis/scorer
 * @description 점수 산출기 - 4차원 가중합 점수 산출 및 등급 결정
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scorer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const router_1 = require("../../llm/router");
const scoring_1 = require("../../types/scoring");
const logger_1 = require("../../utils/logger");
// ── Rule-based scoring constants ──────────────────────────────────────
// These tune the heuristic scoring when no LLM is available.
/** Base score assigned before any action-type or file-count adjustments. */
const COMPLEXITY_BASE = 3;
/** Bonus added for brand-new feature tasks (highest complexity). */
const COMPLEXITY_NEW_BONUS = 3;
/** Bonus added for modification tasks (moderate complexity). */
const COMPLEXITY_MODIFY_BONUS = 1;
/** File-count thresholds for complexity scoring. */
const FILES_HIGH_THRESHOLD = 3; // > 3 files  → +2
const FILES_LOW_THRESHOLD = 1; // > 1 file   → +1
/** API-count threshold for complexity scoring. */
const APIS_THRESHOLD = 2; // > 2 APIs   → +1
/** Base score for impact-scope heuristic. */
const SCOPE_BASE = 2;
/** Screen-count thresholds for scope scoring. */
const SCREENS_HIGH = 5; // > 5 screens → +4
const SCREENS_MEDIUM = 3; // > 3 screens → +3
const SCREENS_LOW = 1; // > 1 screen  → +2
/** File-count thresholds for scope scoring. */
const SCOPE_FILES_HIGH = 5; // > 5 files   → +2
const SCOPE_FILES_LOW = 2; // > 2 files   → +1
/** Maximum per-policy score contribution (caps policy count * 2). */
const POLICY_MAX_CONTRIBUTION = 6;
/** Score bounds – every dimension is clamped to [MIN, MAX]. */
const SCORE_MIN = 1;
const SCORE_MAX = 10;
/** Default total score for tasks not found in the score map. */
const DEFAULT_TASK_TOTAL = 3.0;
/** Task-level grade thresholds (1–10 scale). */
const TASK_GRADE_LOW_MAX = 3.0;
const TASK_GRADE_MEDIUM_MAX = 5.5;
const TASK_GRADE_HIGH_MAX = 7.5;
/**
 * Scorer - 4차원 점수 산출기
 *
 * 가중치:
 * - 개발복잡도: 0.35
 * - 영향범위: 0.30
 * - 정책변경: 0.20
 * - 의존성위험: 0.15
 *
 * 등급:
 * - Low: 0~15
 * - Medium: 16~40
 * - High: 41~70
 * - Critical: 71+
 */
class Scorer {
    constructor(llmRouter) {
        this.llmRouter = llmRouter;
    }
    /**
     * 4차원 점수 산출
     * @param impact - 영향도 분석 결과
     * @returns 점수가 포함된 결과
     */
    async score(impact) {
        let taskScoreMap;
        try {
            taskScoreMap = await this.scoreWithLLM(impact);
        }
        catch (err) {
            if (err instanceof router_1.NoProviderConfiguredError) {
                logger_1.logger.warn('LLM not configured. Using rule-based scoring.');
                taskScoreMap = this.scoreWithRules(impact);
            }
            else {
                throw err;
            }
        }
        // 화면별 점수 계산
        const screenScores = this.buildScreenScores(impact.affectedScreens, taskScoreMap);
        // 총점 및 등급 계산
        const { totalScore, grade } = this.calculateTotalScore(screenScores);
        // 권고사항
        const recommendation = this.getRecommendation(grade);
        return {
            ...impact,
            screenScores,
            totalScore,
            grade,
            recommendation,
        };
    }
    /**
     * LLM 기반 점수 산출
     */
    async scoreWithLLM(impact) {
        const provider = this.llmRouter.route('score-calculation');
        const promptTemplate = this.loadPromptTemplate();
        const prompt = promptTemplate.replace('{영향도 분석 결과 JSON}', JSON.stringify(impact, null, 2));
        const messages = [
            { role: 'user', content: prompt },
        ];
        logger_1.logger.info('Scoring with LLM...');
        const response = await provider.chat(messages, {
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 4096,
        });
        return this.parseLLMScoreResponse(response.content);
    }
    /**
     * 규칙 기반 점수 산출
     */
    scoreWithRules(impact) {
        const map = new Map();
        for (const task of impact.tasks) {
            const scores = this.calculateRuleBasedScores(task, impact);
            const total = this.calculateTaskScore(scores);
            map.set(task.id, { scores, total });
        }
        return map;
    }
    /**
     * 규칙 기반 개별 작업 점수 계산
     */
    calculateRuleBasedScores(task, impact) {
        // 개발 복잡도 추론
        const complexityScore = this.inferComplexity(task);
        // 영향 범위 추론
        const scopeScore = this.inferScope(task, impact);
        // 정책 변경 추론
        const policyScore = this.inferPolicyChange(task, impact);
        // 의존성 위험도 추론
        const dependencyScore = this.inferDependencyRisk(task);
        return {
            developmentComplexity: {
                score: complexityScore,
                weight: scoring_1.SCORE_WEIGHTS.developmentComplexity,
                rationale: this.getComplexityRationale(task, complexityScore),
            },
            impactScope: {
                score: scopeScore,
                weight: scoring_1.SCORE_WEIGHTS.impactScope,
                rationale: this.getScopeRationale(task, scopeScore),
            },
            policyChange: {
                score: policyScore,
                weight: scoring_1.SCORE_WEIGHTS.policyChange,
                rationale: this.getPolicyRationale(task, policyScore),
            },
            dependencyRisk: {
                score: dependencyScore,
                weight: scoring_1.SCORE_WEIGHTS.dependencyRisk,
                rationale: this.getDependencyRationale(task, dependencyScore),
            },
        };
    }
    /**
     * 개발 복잡도 추론
     */
    inferComplexity(task) {
        let score = COMPLEXITY_BASE;
        if (task.actionType === 'new')
            score += COMPLEXITY_NEW_BONUS;
        else if (task.actionType === 'modify')
            score += COMPLEXITY_MODIFY_BONUS;
        // config는 그대로 (no bonus)
        if (task.affectedFiles.length > FILES_HIGH_THRESHOLD)
            score += 2;
        else if (task.affectedFiles.length > FILES_LOW_THRESHOLD)
            score += 1;
        if (task.relatedApis.length > APIS_THRESHOLD)
            score += 1;
        return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
    }
    /**
     * 영향 범위 추론
     */
    inferScope(task, impact) {
        let score = SCOPE_BASE;
        // 영향 받는 화면 수
        const affectedScreenCount = impact.affectedScreens.length;
        if (affectedScreenCount > SCREENS_HIGH)
            score += 4;
        else if (affectedScreenCount > SCREENS_MEDIUM)
            score += 3;
        else if (affectedScreenCount > SCREENS_LOW)
            score += 2;
        else
            score += 1;
        // 영향 받는 파일 수
        if (task.affectedFiles.length > SCOPE_FILES_HIGH)
            score += 2;
        else if (task.affectedFiles.length > SCOPE_FILES_LOW)
            score += 1;
        return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
    }
    /**
     * 정책 변경 추론
     */
    inferPolicyChange(_task, impact) {
        if (impact.policyChanges.length === 0)
            return SCORE_MIN;
        let score = SCOPE_BASE;
        score += Math.min(impact.policyChanges.length * 2, POLICY_MAX_CONTRIBUTION);
        const hasReviewRequired = impact.policyChanges.some(p => p.requiresReview);
        if (hasReviewRequired)
            score += 1;
        return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
    }
    /**
     * 의존성 위험도 추론
     */
    inferDependencyRisk(task) {
        let score = SCORE_MIN;
        if (task.relatedApis.length > 0)
            score += 2;
        if (task.relatedApis.length > APIS_THRESHOLD)
            score += 2;
        if (task.type === 'BE')
            score += 1;
        return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
    }
    /**
     * 작업별 가중합 점수 계산
     * @param breakdown - 4차원 점수 분해
     * @returns 가중합 점수
     */
    calculateTaskScore(breakdown) {
        return (breakdown.developmentComplexity.score * breakdown.developmentComplexity.weight +
            breakdown.impactScope.score * breakdown.impactScope.weight +
            breakdown.policyChange.score * breakdown.policyChange.weight +
            breakdown.dependencyRisk.score * breakdown.dependencyRisk.weight);
    }
    /**
     * 화면별 점수 합산
     * @param taskScores - 작업별 점수 목록
     * @returns 화면 종합 점수
     */
    calculateScreenScore(taskScores) {
        if (taskScores.length === 0)
            return 0;
        const sum = taskScores.reduce((acc, ts) => acc + ts.totalScore, 0);
        return sum;
    }
    /**
     * 총점 및 등급 결정
     * @param screens - 화면별 점수 목록
     * @returns 총점과 등급
     */
    calculateTotalScore(screens) {
        const totalScore = screens.reduce((acc, s) => acc + s.screenScore, 0);
        const grade = this.determineGrade(totalScore);
        return { totalScore, grade };
    }
    /**
     * 점수로 등급 결정
     */
    determineGrade(score) {
        if (score <= scoring_1.GRADE_THRESHOLDS.Low.range.max)
            return 'Low';
        if (score <= scoring_1.GRADE_THRESHOLDS.Medium.range.max)
            return 'Medium';
        if (score <= scoring_1.GRADE_THRESHOLDS.High.range.max)
            return 'High';
        return 'Critical';
    }
    /**
     * 등급별 권고사항
     */
    getRecommendation(grade) {
        return scoring_1.GRADE_THRESHOLDS[grade].recommendation;
    }
    /**
     * 화면별 점수 구성
     */
    buildScreenScores(affectedScreens, taskScoreMap) {
        return affectedScreens.map(screen => {
            const taskScores = screen.tasks.map(task => {
                const scoreInfo = taskScoreMap.get(task.id) || {
                    scores: this.defaultScoreBreakdown(),
                    total: DEFAULT_TASK_TOTAL,
                };
                return {
                    taskId: task.id,
                    scores: scoreInfo.scores,
                    totalScore: scoreInfo.total,
                    grade: this.determineTaskGrade(scoreInfo.total),
                };
            });
            const screenScore = this.calculateScreenScore(taskScores);
            return {
                screenId: screen.screenId,
                screenName: screen.screenName,
                screenScore,
                grade: this.determineGrade(screenScore),
                taskScores,
            };
        });
    }
    /**
     * 작업 등급 결정 (작업 단위 점수는 1~10 범위)
     */
    determineTaskGrade(totalScore) {
        if (totalScore <= TASK_GRADE_LOW_MAX)
            return 'Low';
        if (totalScore <= TASK_GRADE_MEDIUM_MAX)
            return 'Medium';
        if (totalScore <= TASK_GRADE_HIGH_MAX)
            return 'High';
        return 'Critical';
    }
    /**
     * 기본 점수 분해
     */
    defaultScoreBreakdown() {
        return {
            developmentComplexity: { score: COMPLEXITY_BASE, weight: scoring_1.SCORE_WEIGHTS.developmentComplexity, rationale: '기본값' },
            impactScope: { score: COMPLEXITY_BASE, weight: scoring_1.SCORE_WEIGHTS.impactScope, rationale: '기본값' },
            policyChange: { score: SCORE_MIN, weight: scoring_1.SCORE_WEIGHTS.policyChange, rationale: '기본값' },
            dependencyRisk: { score: SCORE_MIN, weight: scoring_1.SCORE_WEIGHTS.dependencyRisk, rationale: '기본값' },
        };
    }
    /**
     * LLM 점수 응답 파싱
     */
    parseLLMScoreResponse(content) {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
        try {
            const parsed = JSON.parse(jsonStr);
            const map = new Map();
            const taskScores = parsed.taskScores || [];
            for (const ts of taskScores) {
                const clamp = (val, fallback) => Math.min(SCORE_MAX, Math.max(SCORE_MIN, val || fallback));
                const scores = {
                    developmentComplexity: {
                        score: clamp(ts.scores?.developmentComplexity?.score, COMPLEXITY_BASE),
                        weight: scoring_1.SCORE_WEIGHTS.developmentComplexity,
                        rationale: ts.scores?.developmentComplexity?.rationale || '',
                    },
                    impactScope: {
                        score: clamp(ts.scores?.impactScope?.score, COMPLEXITY_BASE),
                        weight: scoring_1.SCORE_WEIGHTS.impactScope,
                        rationale: ts.scores?.impactScope?.rationale || '',
                    },
                    policyChange: {
                        score: clamp(ts.scores?.policyChange?.score, SCORE_MIN),
                        weight: scoring_1.SCORE_WEIGHTS.policyChange,
                        rationale: ts.scores?.policyChange?.rationale || '',
                    },
                    dependencyRisk: {
                        score: clamp(ts.scores?.dependencyRisk?.score, SCORE_MIN),
                        weight: scoring_1.SCORE_WEIGHTS.dependencyRisk,
                        rationale: ts.scores?.dependencyRisk?.rationale || '',
                    },
                };
                const total = this.calculateTaskScore(scores);
                map.set(ts.taskId, { scores, total });
            }
            return map;
        }
        catch {
            throw new Error('Failed to parse LLM score response as JSON.');
        }
    }
    /**
     * 프롬프트 템플릿 로드
     */
    loadPromptTemplate() {
        const templatePath = path.join(__dirname, '..', '..', '..', 'prompts', 'score-difficulty.prompt.md');
        try {
            if (fs.existsSync(templatePath)) {
                return fs.readFileSync(templatePath, 'utf-8');
            }
        }
        catch {
            logger_1.logger.debug('Failed to load score prompt template.');
        }
        return `각 작업에 대해 4차원 점수를 산출하세요.

<impact_result>
{영향도 분석 결과 JSON}
</impact_result>

JSON 형식으로 taskScores를 출력하세요.`;
    }
    // Rationale helpers
    getComplexityRationale(task, score) {
        if (task.actionType === 'new') {
            return `신규 개발 작업. 영향 파일 ${task.affectedFiles.length}개. (score: ${score})`;
        }
        if (task.actionType === 'config') {
            return `설정 변경 작업. 상대적으로 낮은 복잡도. (score: ${score})`;
        }
        return `기존 코드 수정 작업. 영향 파일 ${task.affectedFiles.length}개. (score: ${score})`;
    }
    getScopeRationale(task, score) {
        return `영향 파일 ${task.affectedFiles.length}개, 관련 API ${task.relatedApis.length}개. (score: ${score})`;
    }
    getPolicyRationale(task, score) {
        return `기획 확인 사항 ${task.planningChecks.length}개. (score: ${score})`;
    }
    getDependencyRationale(task, score) {
        return `관련 API ${task.relatedApis.length}개, 작업 유형: ${task.type}. (score: ${score})`;
    }
}
exports.Scorer = Scorer;
//# sourceMappingURL=scorer.js.map