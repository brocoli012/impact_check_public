"use strict";
/**
 * @module core/analysis/analyzer
 * @description 영향도 분석기 - 규칙 기반 영향도 심층 분석
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
/**
 * ImpactAnalyzer - 영향도 심층 분석
 *
 * 규칙 기반으로 영향도를 심층 분석합니다.
 */
class ImpactAnalyzer {
    /**
     * 영향도 심층 분석 (규칙 기반)
     * @param spec - 파싱된 기획서
     * @param matched - 매칭된 엔티티
     * @param index - 코드 인덱스
     * @returns 영향도 분석 결과
     */
    async analyze(spec, matched, index) {
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
            // REQ-009: 출처 요구사항/기능 ID 매칭
            const taskTitle = `[FE] ${feature.name} - ${screenName}`;
            const taskDescription = `${screenName}에서 ${feature.description}`;
            const sourceRequirementIds = this.matchRequirementIds(spec, taskTitle, taskDescription);
            const sourceFeatureIds = [feature.id];
            tasks.push({
                id: taskId,
                title: taskTitle,
                type: 'FE',
                actionType: feature.actionType,
                description: taskDescription,
                affectedFiles,
                relatedApis,
                planningChecks: [],
                rationale: `기획서 기능 "${feature.name}"이 화면 "${screenName}"에 영향. 매칭 기반 분석.`,
                sourceRequirementIds,
                sourceFeatureIds,
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
    generateAdditionalTasks(spec, matched, index, _existingScreens) {
        const tasks = [];
        let counter = 100;
        // 매칭된 API에 대한 BE 작업
        for (const api of matched.apis) {
            if (api.matchScore < 0.5)
                continue;
            counter++;
            const apiInfo = index.apis.find(a => a.id === api.id);
            const affectedFiles = apiInfo ? [apiInfo.filePath] : [];
            // REQ-009: 출처 요구사항/기능 ID 매칭
            const taskTitle = `[BE] API 수정 - ${api.name}`;
            const taskDescription = `API ${api.name} 수정이 필요할 수 있습니다.`;
            const sourceRequirementIds = this.matchRequirementIds(spec, taskTitle, taskDescription);
            const sourceFeatureIds = this.matchFeatureIds(spec, taskTitle, taskDescription);
            tasks.push({
                id: `T-${String(counter).padStart(3, '0')}`,
                title: taskTitle,
                type: 'BE',
                actionType: 'modify',
                description: taskDescription,
                affectedFiles,
                relatedApis: [api.id],
                planningChecks: [],
                rationale: `매칭된 API "${api.name}" (score: ${api.matchScore.toFixed(2)})`,
                sourceRequirementIds,
                sourceFeatureIds,
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
     * 출처 요구사항 ID 매칭 (REQ-009)
     *
     * Task의 제목/설명과 요구사항의 이름/설명 간 키워드 오버랩으로 매칭합니다.
     */
    matchRequirementIds(spec, taskTitle, taskDescription) {
        const taskText = [taskTitle, taskDescription].join(' ').toLowerCase();
        return spec.requirements
            .filter(req => {
            const reqKeywords = [req.name, ...req.description.split(/[\s,]+/)]
                .map(k => k.toLowerCase())
                .filter(k => k.length > 2 && !ImpactAnalyzer.KOREAN_STOP_WORDS.has(k));
            return reqKeywords.some(k => taskText.includes(k));
        })
            .map(req => req.id);
    }
    /**
     * 출처 기능 ID 매칭 (REQ-009)
     *
     * Task의 제목/설명과 기능의 이름/키워드 간 키워드 오버랩으로 매칭합니다.
     */
    matchFeatureIds(spec, taskTitle, taskDescription) {
        const taskText = [taskTitle, taskDescription].join(' ').toLowerCase();
        return spec.features
            .filter(feat => {
            const featKeywords = [feat.name, ...feat.keywords]
                .map(k => k.toLowerCase())
                .filter(k => k.length > 2 && !ImpactAnalyzer.KOREAN_STOP_WORDS.has(k));
            return featKeywords.some(k => taskText.includes(k));
        })
            .map(feat => feat.id);
    }
    /**
     * 인덱스에서 유효한 파일 경로 집합을 구축
     *
     * files, screens, components, apis, models, policies의
     * 모든 파일 경로를 수집하여 결과 검증에 사용합니다.
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
}
exports.ImpactAnalyzer = ImpactAnalyzer;
/** 매칭에서 제외할 한국어 불용어 목록 */
ImpactAnalyzer.KOREAN_STOP_WORDS = new Set([
    '변경', '작업', '필요', '관련', '확인', '처리', '기능', '사항',
    '경우', '부분', '내용', '항목', '대한', '위한', '따른', '통한',
]);
//# sourceMappingURL=analyzer.js.map