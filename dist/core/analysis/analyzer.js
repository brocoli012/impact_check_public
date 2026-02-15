"use strict";
/**
 * @module core/analysis/analyzer
 * @description 영향도 분석기 - LLM 기반 영향도 심층 분석
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
exports.ImpactAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const router_1 = require("../../llm/router");
const logger_1 = require("../../utils/logger");
/**
 * ImpactAnalyzer - 영향도 심층 분석
 *
 * LLM (Claude Sonnet)으로 영향도 심층 분석.
 * LLM 미설정 시 규칙 기반 폴백 분석 제공.
 */
class ImpactAnalyzer {
    constructor(llmRouter) {
        this.llmRouter = llmRouter;
    }
    /**
     * 영향도 심층 분석 (LLM 사용)
     * @param spec - 파싱된 기획서
     * @param matched - 매칭된 엔티티
     * @param index - 코드 인덱스
     * @returns 영향도 분석 결과
     */
    async analyze(spec, matched, index) {
        try {
            return await this.analyzeWithLLM(spec, matched, index);
        }
        catch (err) {
            if (err instanceof router_1.NoProviderConfiguredError) {
                logger_1.logger.warn('LLM not configured. Using rule-based analysis fallback.');
                return this.analyzeWithoutLLM(spec, matched, index);
            }
            throw err;
        }
    }
    /**
     * LLM을 사용한 영향도 분석
     */
    async analyzeWithLLM(spec, matched, index) {
        const provider = this.llmRouter.route('impact-analysis');
        const promptTemplate = this.loadPromptTemplate();
        const prompt = promptTemplate
            .replace('{파싱된 기획서 JSON}', JSON.stringify(spec, null, 2))
            .replace('{인덱스 매칭 결과 JSON}', JSON.stringify(matched, null, 2))
            .replace('{관련 코드 스니펫}', this.buildCodeSnippets(matched, index));
        const messages = [
            { role: 'user', content: prompt },
        ];
        logger_1.logger.info('Analyzing impact with LLM...');
        const response = await provider.chat(messages, {
            responseFormat: 'json',
            temperature: 0.2,
            maxTokens: 8192,
        });
        const parsed = this.parseLLMResponse(response.content);
        const result = this.buildImpactResult(spec, parsed, index);
        result.analysisMethod = 'llm';
        return result;
    }
    /**
     * LLM 없이 규칙 기반 분석 (폴백)
     * @param spec - 파싱된 기획서
     * @param matched - 매칭된 엔티티
     * @param index - 코드 인덱스
     * @returns 영향도 분석 결과
     */
    analyzeWithoutLLM(spec, matched, index) {
        logger_1.logger.info('Using rule-based impact analysis...');
        const analysisId = `analysis-${Date.now()}`;
        const now = new Date().toISOString();
        // 매칭된 화면에서 ScreenImpact 생성
        const affectedScreens = matched.screens.map((screen, screenIdx) => {
            // 해당 화면과 관련된 작업 생성
            const tasks = this.generateTasksForScreen(screen.id, screen.name, spec, matched, index, screenIdx);
            return {
                screenId: screen.id,
                screenName: screen.name,
                impactLevel: this.determineImpactLevel(screen.matchScore, tasks.length),
                tasks,
            };
        });
        // 추가 작업: 화면에 속하지 않는 API/모델 변경 작업
        const additionalTasks = this.generateAdditionalTasks(spec, matched, index, affectedScreens);
        // 전체 작업 목록
        const allTasks = [
            ...affectedScreens.flatMap(s => s.tasks),
            ...additionalTasks,
        ];
        // 기획 확인 사항
        const planningChecks = this.generatePlanningChecks(spec, matched);
        // 정책 변경 사항
        const policyChanges = this.detectPolicyChanges(spec, matched, index);
        return {
            analysisId,
            analyzedAt: now,
            specTitle: spec.title,
            analysisMethod: 'rule-based',
            affectedScreens,
            tasks: allTasks,
            planningChecks,
            policyChanges,
        };
    }
    /**
     * 화면별 작업 생성
     */
    generateTasksForScreen(screenId, screenName, spec, matched, index, screenIdx) {
        const tasks = [];
        let taskCounter = screenIdx * 10;
        // 관련 기능에서 작업 도출
        for (const feature of spec.features) {
            // 화면명과 기능의 대상 화면이 매칭되는지 확인
            const isRelevant = this.isFeatureRelevantToScreen(feature, screenName, screenId, index);
            if (!isRelevant && spec.features.length > 1)
                continue;
            taskCounter++;
            const taskId = `T-${String(taskCounter).padStart(3, '0')}`;
            // 영향 받는 파일 식별
            const screen = index.screens.find(s => s.id === screenId);
            const affectedFiles = screen ? [screen.filePath] : [];
            // 관련 API 식별
            const relatedApis = matched.apis
                .filter(a => a.matchScore > 0.5)
                .map(a => a.id);
            tasks.push({
                id: taskId,
                title: `[FE] ${feature.name} - ${screenName}`,
                type: 'FE',
                actionType: feature.actionType,
                description: `${screenName}에서 ${feature.description}`,
                affectedFiles,
                relatedApis,
                planningChecks: [],
                rationale: `기획서 기능 "${feature.name}"이 화면 "${screenName}"에 영향. 매칭 기반 분석.`,
            });
        }
        return tasks;
    }
    /**
     * 기능이 화면과 관련 있는지 판단
     */
    isFeatureRelevantToScreen(feature, screenName, _screenId, _index) {
        const targetScreen = feature.targetScreen?.toLowerCase() || '';
        const sName = screenName.toLowerCase();
        if (targetScreen && sName.includes(targetScreen))
            return true;
        if (targetScreen && targetScreen.includes(sName))
            return true;
        // 키워드 기반 매칭
        for (const keyword of feature.keywords) {
            if (sName.includes(keyword.toLowerCase()))
                return true;
        }
        return false;
    }
    /**
     * 추가 작업 생성 (API/BE 작업)
     */
    generateAdditionalTasks(_spec, matched, index, _existingScreens) {
        const tasks = [];
        let counter = 100;
        // 매칭된 API에 대한 BE 작업
        for (const api of matched.apis) {
            if (api.matchScore < 0.5)
                continue;
            counter++;
            const apiInfo = index.apis.find(a => a.id === api.id);
            const affectedFiles = apiInfo ? [apiInfo.filePath] : [];
            tasks.push({
                id: `T-${String(counter).padStart(3, '0')}`,
                title: `[BE] API 수정 - ${api.name}`,
                type: 'BE',
                actionType: 'modify',
                description: `API ${api.name} 수정이 필요할 수 있습니다.`,
                affectedFiles,
                relatedApis: [api.id],
                planningChecks: [],
                rationale: `매칭된 API "${api.name}" (score: ${api.matchScore.toFixed(2)})`,
            });
        }
        return tasks;
    }
    /**
     * 영향도 수준 결정
     */
    determineImpactLevel(matchScore, taskCount) {
        const composite = matchScore * 0.6 + Math.min(taskCount / 5, 1) * 0.4;
        if (composite >= 0.8)
            return 'critical';
        if (composite >= 0.6)
            return 'high';
        if (composite >= 0.3)
            return 'medium';
        return 'low';
    }
    /**
     * 기획 확인 사항 생성
     */
    generatePlanningChecks(spec, matched) {
        const checks = [];
        let counter = 0;
        // 기획서의 불명확한 사항을 확인 항목으로 변환
        for (const ambiguity of spec.ambiguities) {
            counter++;
            checks.push({
                id: `PC-${String(counter).padStart(3, '0')}`,
                content: ambiguity,
                relatedFeatureId: spec.features[0]?.id || '',
                priority: 'high',
                status: 'pending',
            });
        }
        // 매칭 점수가 낮은 엔티티에 대한 확인 요청
        const lowConfidenceScreens = matched.screens.filter(s => s.matchScore < 0.5 && s.matchScore > 0);
        for (const screen of lowConfidenceScreens) {
            counter++;
            checks.push({
                id: `PC-${String(counter).padStart(3, '0')}`,
                content: `화면 "${screen.name}"이 실제로 영향을 받는지 기획자 확인이 필요합니다. (매칭 신뢰도: ${(screen.matchScore * 100).toFixed(0)}%)`,
                relatedFeatureId: '',
                priority: 'medium',
                status: 'pending',
            });
        }
        return checks;
    }
    /**
     * 정책 변경 사항 감지
     */
    detectPolicyChanges(spec, _matched, index) {
        const changes = [];
        let counter = 0;
        // 비즈니스 규칙에서 정책 변경 추론
        for (const rule of spec.businessRules) {
            // 인덱스의 정책과 비교
            for (const policy of index.policies) {
                const ruleText = rule.description.toLowerCase();
                const policyText = policy.name.toLowerCase();
                if (this.hasOverlap(ruleText, policyText)) {
                    counter++;
                    changes.push({
                        id: `POL-${String(counter).padStart(3, '0')}`,
                        policyName: policy.name,
                        description: `기획서의 비즈니스 규칙 "${rule.description}"이 기존 정책 "${policy.name}"과 관련될 수 있습니다.`,
                        changeType: 'modify',
                        affectedFiles: [policy.filePath],
                        requiresReview: true,
                    });
                }
            }
        }
        return changes;
    }
    /**
     * 두 텍스트 간 키워드 중복 확인
     */
    hasOverlap(text1, text2) {
        const words1 = text1.split(/[\s,]+/).filter(w => w.length >= 2 && !ImpactAnalyzer.KOREAN_STOP_WORDS.has(w));
        const words2 = text2.split(/[\s,]+/).filter(w => w.length >= 2 && !ImpactAnalyzer.KOREAN_STOP_WORDS.has(w));
        return words1.some(w => words2.includes(w));
    }
    /**
     * LLM 응답 파싱
     */
    parseLLMResponse(content) {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
        try {
            return JSON.parse(jsonStr);
        }
        catch {
            throw new Error('LLM response for impact analysis is not valid JSON.');
        }
    }
    /**
     * LLM 응답을 ImpactResult로 변환
     *
     * Tech design R7: LLM 응답의 affectedFiles에 포함된 파일 경로가
     * 실제 인덱스에 존재하는지 검증하고, 존재하지 않는 경로는 자동 제거합니다.
     * 이를 통해 LLM hallucination으로 인한 허위 파일 경로를 방지합니다.
     *
     * @param spec - 파싱된 기획서
     * @param parsed - LLM 응답 파싱 결과
     * @param index - 코드 인덱스 (파일 경로 검증용, 선택)
     */
    buildImpactResult(spec, parsed, index) {
        const analysisId = `analysis-${Date.now()}`;
        const now = new Date().toISOString();
        // 인덱스에서 유효한 파일 경로 집합을 구축 (hallucination 방지)
        const validFilePaths = index ? this.buildValidFilePathSet(index) : null;
        const rawScreens = (parsed.affectedScreens || []);
        const rawChecks = (parsed.planningChecks || []);
        const rawPolicyChanges = (parsed.policyChanges || []);
        const affectedScreens = rawScreens.map((s) => {
            const tasks = (s.tasks || []).map((t) => {
                let affectedFiles = (t.affectedFiles || []);
                // LLM이 생성한 파일 경로를 인덱스에 존재하는 경로만 남기도록 필터링
                if (validFilePaths) {
                    const originalCount = affectedFiles.length;
                    affectedFiles = affectedFiles.filter(fp => validFilePaths.has(fp));
                    const removedCount = originalCount - affectedFiles.length;
                    if (removedCount > 0) {
                        logger_1.logger.warn(`Task "${String(t.id || '')}": Removed ${removedCount} hallucinated file path(s) not found in index.`);
                    }
                }
                return {
                    id: String(t.id || ''),
                    title: String(t.title || ''),
                    type: String(t.type || 'FE'),
                    actionType: String(t.actionType || 'modify'),
                    description: String(t.description || ''),
                    affectedFiles,
                    relatedApis: (t.relatedApis || []),
                    planningChecks: (t.planningChecks || []),
                    rationale: String(t.rationale || ''),
                };
            });
            return {
                screenId: String(s.screenId || ''),
                screenName: String(s.screenName || ''),
                impactLevel: String(s.impactLevel || 'medium'),
                tasks,
            };
        });
        const planningChecks = rawChecks.map((c) => ({
            id: String(c.id || ''),
            content: String(c.content || ''),
            relatedFeatureId: String(c.relatedFeatureId || ''),
            priority: String(c.priority || 'medium'),
            status: 'pending',
        }));
        const policyChanges = rawPolicyChanges.map((p) => {
            let affectedFiles = (p.affectedFiles || []);
            // 정책 변경의 affectedFiles도 인덱스 기반으로 검증
            if (validFilePaths) {
                affectedFiles = affectedFiles.filter(fp => validFilePaths.has(fp));
            }
            return {
                id: String(p.id || ''),
                policyName: String(p.policyName || ''),
                description: String(p.description || ''),
                changeType: String(p.changeType || 'modify'),
                affectedFiles,
                requiresReview: Boolean(p.requiresReview),
            };
        });
        const allTasks = affectedScreens.flatMap(s => s.tasks);
        return {
            analysisId,
            analyzedAt: now,
            specTitle: spec.title,
            affectedScreens,
            tasks: allTasks,
            planningChecks,
            policyChanges,
        };
    }
    /**
     * 매칭된 엔티티에서 코드 스니펫 구성
     */
    buildCodeSnippets(matched, index) {
        const snippets = [];
        // 매칭된 화면의 파일 경로
        for (const screen of matched.screens.slice(0, 5)) {
            const screenInfo = index.screens.find(s => s.id === screen.id);
            if (screenInfo) {
                snippets.push(`Screen: ${screenInfo.name} (${screenInfo.filePath}), route: ${screenInfo.route}`);
            }
        }
        // 매칭된 컴포넌트
        for (const comp of matched.components.slice(0, 5)) {
            const compInfo = index.components.find(c => c.id === comp.id);
            if (compInfo) {
                snippets.push(`Component: ${compInfo.name} (${compInfo.filePath}), props: [${compInfo.props.join(', ')}]`);
            }
        }
        // 매칭된 API
        for (const api of matched.apis.slice(0, 5)) {
            const apiInfo = index.apis.find(a => a.id === api.id);
            if (apiInfo) {
                snippets.push(`API: ${apiInfo.method} ${apiInfo.path} (${apiInfo.filePath})`);
            }
        }
        return snippets.join('\n') || 'No code snippets available.';
    }
    /**
     * 인덱스에서 유효한 파일 경로 집합을 구축
     *
     * files, screens, components, apis, models, policies의
     * 모든 파일 경로를 수집하여 LLM 응답 검증에 사용합니다.
     */
    buildValidFilePathSet(index) {
        const paths = new Set();
        // files 배열의 path
        for (const file of index.files) {
            paths.add(file.path);
        }
        // screens의 filePath
        for (const screen of index.screens) {
            paths.add(screen.filePath);
        }
        // components의 filePath
        for (const comp of index.components) {
            paths.add(comp.filePath);
        }
        // apis의 filePath
        for (const api of index.apis) {
            paths.add(api.filePath);
        }
        // models의 filePath
        for (const model of index.models) {
            paths.add(model.filePath);
        }
        // policies의 filePath
        for (const policy of index.policies) {
            paths.add(policy.filePath);
        }
        return paths;
    }
    /**
     * 프롬프트 템플릿 로드
     */
    loadPromptTemplate() {
        const templatePath = path.join(__dirname, '..', '..', '..', 'prompts', 'analyze-impact.prompt.md');
        try {
            if (fs.existsSync(templatePath)) {
                return fs.readFileSync(templatePath, 'utf-8');
            }
        }
        catch {
            logger_1.logger.debug('Failed to load impact analysis prompt template.');
        }
        return `영향도 분석을 수행하세요.

<parsed_spec>
{파싱된 기획서 JSON}
</parsed_spec>

<matched_entities>
{인덱스 매칭 결과 JSON}
</matched_entities>

<code_snippets>
{관련 코드 스니펫}
</code_snippets>

JSON 형식으로 affectedScreens, planningChecks, policyChanges를 출력하세요.`;
    }
}
exports.ImpactAnalyzer = ImpactAnalyzer;
/** 매칭에서 제외할 한국어 불용어 목록 */
ImpactAnalyzer.KOREAN_STOP_WORDS = new Set([
    '변경', '작업', '필요', '관련', '확인', '처리', '기능', '사항',
    '경우', '부분', '내용', '항목', '대한', '위한', '따른', '통한',
]);
//# sourceMappingURL=analyzer.js.map