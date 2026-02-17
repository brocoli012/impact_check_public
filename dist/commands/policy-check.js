"use strict";
/**
 * @module commands/policy-check
 * @description PolicyCheck 명령어 핸들러 - 정책 영향도 분석
 *
 * 기능:
 *   - 전체 정책 현황 요약 (옵션 없이 실행)
 *   - --policy <이름>: 특정 정책 상세 조회 (부분 매칭)
 *   - --change <설명>: 변경 내용이 기존 정책에 미치는 영향 분석
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
exports.PolicyCheckCommand = void 0;
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const indexer_1 = require("../core/indexing/indexer");
const annotation_loader_1 = require("../core/annotations/annotation-loader");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * PolicyCheckCommand - 정책 영향도 분석 명령어
 *
 * 사용법:
 *   /impact policy-check                          - 전체 정책 현황 요약
 *   /impact policy-check --policy <name>          - 특정 정책 상세 조회
 *   /impact policy-check --change <description>   - 변경 영향도 분석
 */
class PolicyCheckCommand {
    constructor(args) {
        this.name = 'policy-check';
        this.description = '정책 영향도 분석';
        this.args = args;
    }
    async execute() {
        try {
            // 1. 활성 프로젝트 확인
            const { projectId } = await this.getActiveProject();
            // 2. 인덱스 로드
            const indexer = new indexer_1.Indexer();
            const codeIndex = await indexer.loadIndex(projectId);
            if (!codeIndex) {
                logger_1.logger.error('인덱스가 없습니다. 먼저 /impact reindex를 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: '인덱스가 없습니다. 먼저 /impact reindex를 실행하세요.',
                };
            }
            // 옵션 파싱
            const policyIdx = this.args.indexOf('--policy');
            const changeIdx = this.args.indexOf('--change');
            if (policyIdx !== -1) {
                const policyName = this.args[policyIdx + 1];
                if (!policyName) {
                    logger_1.logger.error('정책명을 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: '정책명을 지정해주세요. 예: --policy "배송비"',
                    };
                }
                return this.handlePolicyDetail(codeIndex, projectId, policyName);
            }
            if (changeIdx !== -1) {
                const changeDesc = this.args[changeIdx + 1];
                if (!changeDesc) {
                    logger_1.logger.error('변경 내용을 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: '변경 내용을 지정해주세요. 예: --change "무료배송 기준 3만원으로 변경"',
                    };
                }
                return this.handleChangeImpact(codeIndex, projectId, changeDesc);
            }
            // 기본: 전체 정책 현황 요약
            return this.handleSummary(codeIndex);
        }
        catch (err) {
            if (err instanceof ProjectNotFoundError) {
                return {
                    code: common_1.ResultCode.NEEDS_CONFIG,
                    message: err.message,
                };
            }
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`정책 영향도 분석 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Policy check failed: ${errorMsg}`,
            };
        }
    }
    // ============================================================
    // 전체 정책 현황 요약 (기본 동작)
    // ============================================================
    handleSummary(codeIndex) {
        const policies = codeIndex.policies;
        logger_1.logger.header('정책 영향도 분석 - 현황 요약');
        if (policies.length === 0) {
            console.log('\n등록된 정책이 없습니다.');
            console.log('프로젝트를 인덱싱하면 코드에서 정책이 자동으로 추출됩니다.');
            console.log('인덱싱: /impact reindex');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'No policies found.',
                data: { totalPolicies: 0, categories: {} },
            };
        }
        // 카테고리별 그룹핑
        const categoryMap = new Map();
        for (const policy of policies) {
            const cat = policy.category || '미분류';
            if (!categoryMap.has(cat)) {
                categoryMap.set(cat, []);
            }
            categoryMap.get(cat).push(policy);
        }
        console.log(`\n총 ${policies.length}개 정책, ${categoryMap.size}개 카테고리\n`);
        // 카테고리별 출력
        const categoryStats = {};
        for (const [category, catPolicies] of categoryMap) {
            const relatedFiles = new Set();
            for (const p of catPolicies) {
                relatedFiles.add(p.filePath);
            }
            console.log(`  [${category}]`);
            console.log(`    정책 수: ${catPolicies.length}`);
            console.log(`    관련 파일 수: ${relatedFiles.size}`);
            console.log('');
            categoryStats[category] = {
                policyCount: catPolicies.length,
                fileCount: relatedFiles.size,
            };
        }
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Policy summary: ${policies.length} policies in ${categoryMap.size} categories.`,
            data: { totalPolicies: policies.length, categories: categoryStats },
        };
    }
    // ============================================================
    // --policy: 특정 정책 상세 조회
    // ============================================================
    async handlePolicyDetail(codeIndex, projectId, policyName) {
        const lowerName = policyName.toLowerCase();
        // 부분 매칭 검색
        const matched = codeIndex.policies.filter(p => p.name.toLowerCase().includes(lowerName) ||
            p.description.toLowerCase().includes(lowerName));
        logger_1.logger.header(`정책 상세 조회: "${policyName}"`);
        if (matched.length === 0) {
            console.log(`\n"${policyName}"에 해당하는 정책을 찾을 수 없습니다.`);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `해당 정책을 찾을 수 없습니다: "${policyName}"`,
                data: { query: policyName, matched: [] },
            };
        }
        console.log(`\n${matched.length}개의 정책이 검색되었습니다.\n`);
        // 보강 주석 로드 시도 (폴백 가능)
        let annotationMap = new Map();
        try {
            const annotationLoader = new annotation_loader_1.AnnotationLoader();
            const relatedFiles = [...new Set(matched.map(p => p.filePath))];
            annotationMap = await annotationLoader.loadForFiles(projectId, relatedFiles);
        }
        catch {
            // 보강 주석 로드 실패 시 기본 정보만 출력 (폴백)
        }
        for (const policy of matched) {
            console.log(`  [${policy.id}] ${policy.name}`);
            console.log(`    카테고리: ${policy.category}`);
            console.log(`    설명: ${policy.description}`);
            console.log(`    파일: ${policy.filePath}:${policy.lineNumber}`);
            // 관련 파일 목록 (dependsOn/usedBy)
            const relatedEdges = this.getRelatedEdges(codeIndex, policy);
            if (relatedEdges.dependsOn.length > 0) {
                console.log(`    의존 대상: ${relatedEdges.dependsOn.join(', ')}`);
            }
            if (relatedEdges.usedBy.length > 0) {
                console.log(`    사용처: ${relatedEdges.usedBy.join(', ')}`);
            }
            // 보강 주석이 있으면 추가 상세 출력
            const annotation = annotationMap.get(policy.filePath);
            if (annotation) {
                this.displayAnnotationDetails(annotation, policy);
            }
            console.log('');
        }
        // 충돌 가능 정책 식별 (동일 카테고리 내 다른 정책)
        const conflictCandidates = this.findConflictCandidates(codeIndex.policies, matched);
        if (conflictCandidates.length > 0) {
            console.log('  충돌 가능 정책:');
            for (const conflict of conflictCandidates) {
                console.log(`    - ${conflict.name} (${conflict.category})`);
            }
            console.log('');
        }
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Found ${matched.length} policies matching "${policyName}".`,
            data: {
                query: policyName,
                matched,
                conflicts: conflictCandidates,
                hasAnnotations: annotationMap.size > 0,
            },
        };
    }
    // ============================================================
    // --change: 변경 영향도 분석
    // ============================================================
    async handleChangeImpact(codeIndex, _projectId, changeDesc) {
        logger_1.logger.header('정책 변경 영향도 분석');
        // 1. 키워드 추출 (공백/쉼표 분리, 1글자 이하 무시)
        const keywords = this.extractKeywords(changeDesc);
        console.log(`\n변경 내용: "${changeDesc}"`);
        console.log(`추출 키워드: ${keywords.join(', ')}\n`);
        // 2. 키워드로 인덱스 검색
        const matchedPolicies = this.searchByKeywords(codeIndex, keywords);
        if (matchedPolicies.length === 0) {
            console.log('영향받는 정책을 찾을 수 없습니다.');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: '영향받는 정책을 찾을 수 없습니다.',
                data: { changeDesc, keywords, matchedPolicies: [] },
            };
        }
        console.log(`영향받는 정책: ${matchedPolicies.length}개\n`);
        // 3. 각 매칭 정책의 영향 범위 분석
        for (const policy of matchedPolicies) {
            const relatedFiles = this.getFilesForPolicy(codeIndex, policy);
            console.log(`  [${policy.name}]`);
            console.log(`    카테고리: ${policy.category}`);
            console.log(`    설명: ${policy.description}`);
            console.log(`    관련 파일 수: ${relatedFiles.length}`);
            if (relatedFiles.length > 0) {
                for (const f of relatedFiles.slice(0, 5)) {
                    console.log(`      - ${f}`);
                }
                if (relatedFiles.length > 5) {
                    console.log(`      ... 외 ${relatedFiles.length - 5}개`);
                }
            }
            console.log('');
        }
        // 4. 주의사항 출력
        console.log('  주의사항:');
        console.log('    - 정책 변경 시 관련 테스트 케이스를 반드시 확인하세요.');
        console.log('    - 동일 카테고리의 다른 정책에 부작용이 없는지 검토하세요.');
        console.log('');
        // 5. 기획자 체크리스트 출력
        const checklist = this.generateChecklist(matchedPolicies, changeDesc);
        console.log('  기획자 체크리스트:');
        for (const item of checklist) {
            console.log(`    [ ] ${item}`);
        }
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Change impact analysis: ${matchedPolicies.length} policies affected.`,
            data: {
                changeDesc,
                keywords,
                matchedPolicies,
                checklist,
            },
        };
    }
    // ============================================================
    // Helper Methods
    // ============================================================
    /**
     * 활성 프로젝트 정보를 가져온다.
     */
    async getActiveProject() {
        const configManager = new config_manager_1.ConfigManager();
        await configManager.load();
        const activeProjectId = configManager.getActiveProject();
        if (!activeProjectId) {
            throw new ProjectNotFoundError('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
        }
        const impactDir = (0, file_1.getImpactDir)();
        const projectsPath = path.join(impactDir, 'projects.json');
        const projectsConfig = (0, file_1.readJsonFile)(projectsPath);
        if (!projectsConfig) {
            throw new ProjectNotFoundError('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
        }
        const project = projectsConfig.projects.find(p => p.id === activeProjectId);
        if (!project) {
            throw new ProjectNotFoundError(`프로젝트를 찾을 수 없습니다: ${activeProjectId}`);
        }
        return { projectId: activeProjectId, projectPath: project.path };
    }
    /**
     * 의존 관계 그래프에서 관련 서브그래프 추출
     */
    getRelatedEdges(codeIndex, policy) {
        const graph = codeIndex.dependencies.graph;
        // 정책 파일과 관련된 노드 찾기
        const relatedNodeIds = new Set();
        // 컴포넌트, API 등에서 해당 파일 경로와 매칭되는 노드 찾기
        for (const node of graph.nodes) {
            const comp = codeIndex.components.find(c => c.id === node.id);
            const api = codeIndex.apis.find(a => a.id === node.id);
            const screen = codeIndex.screens.find(s => s.id === node.id);
            if ((comp && comp.filePath === policy.filePath) ||
                (api && api.filePath === policy.filePath) ||
                (screen && screen.filePath === policy.filePath)) {
                relatedNodeIds.add(node.id);
            }
        }
        const dependsOn = [];
        const usedBy = [];
        for (const edge of graph.edges) {
            if (relatedNodeIds.has(edge.from)) {
                const targetNode = graph.nodes.find(n => n.id === edge.to);
                if (targetNode) {
                    dependsOn.push(targetNode.name);
                }
            }
            if (relatedNodeIds.has(edge.to)) {
                const sourceNode = graph.nodes.find(n => n.id === edge.from);
                if (sourceNode) {
                    usedBy.push(sourceNode.name);
                }
            }
        }
        return { dependsOn, usedBy };
    }
    /**
     * 보강 주석 상세 출력
     */
    displayAnnotationDetails(annotation, policy) {
        // 해당 정책과 관련된 보강 주석의 정책 정보 찾기
        for (const ann of annotation.annotations) {
            if (!ann.policies)
                continue;
            for (const inferredPolicy of ann.policies) {
                if (inferredPolicy.name.toLowerCase().includes(policy.name.toLowerCase())) {
                    if (inferredPolicy.conditions && inferredPolicy.conditions.length > 0) {
                        console.log('    조건 분기:');
                        for (const cond of inferredPolicy.conditions) {
                            console.log(`      ${cond.order}. [${cond.type}] ${cond.condition} -> ${cond.result}`);
                        }
                    }
                    if (inferredPolicy.constraints && inferredPolicy.constraints.length > 0) {
                        console.log('    제약사항:');
                        for (const constraint of inferredPolicy.constraints) {
                            console.log(`      [${constraint.severity}] ${constraint.description}`);
                        }
                    }
                    if (inferredPolicy.inputVariables && inferredPolicy.inputVariables.length > 0) {
                        console.log('    입력 변수:');
                        for (const v of inferredPolicy.inputVariables) {
                            console.log(`      - ${v.name} (${v.type}): ${v.description}`);
                        }
                    }
                    break;
                }
            }
        }
    }
    /**
     * 충돌 가능 정책 식별 (동일 카테고리 내 다른 정책)
     */
    findConflictCandidates(allPolicies, matchedPolicies) {
        const matchedIds = new Set(matchedPolicies.map(p => p.id));
        const matchedCategories = new Set(matchedPolicies.map(p => p.category));
        return allPolicies.filter(p => matchedCategories.has(p.category) && !matchedIds.has(p.id));
    }
    /**
     * 변경 내용에서 키워드 추출
     */
    extractKeywords(changeDesc) {
        // 공백, 쉼표, 마침표 등으로 분리
        const tokens = changeDesc.split(/[\s,.\-_:;!?'"()[\]{}]+/);
        // 1글자 이하, 조사/어미 등 짧은 토큰 제거
        return tokens.filter(t => t.length > 1);
    }
    /**
     * 키워드로 인덱스 검색 (파일명, 컴포넌트명, API 경로, 정책명 매칭)
     */
    searchByKeywords(codeIndex, keywords) {
        const matchedSet = new Set();
        const result = [];
        for (const policy of codeIndex.policies) {
            for (const keyword of keywords) {
                const lowerKeyword = keyword.toLowerCase();
                const nameMatch = policy.name.toLowerCase().includes(lowerKeyword);
                const descMatch = policy.description.toLowerCase().includes(lowerKeyword);
                const categoryMatch = policy.category.toLowerCase().includes(lowerKeyword);
                const fileMatch = policy.filePath.toLowerCase().includes(lowerKeyword);
                if ((nameMatch || descMatch || categoryMatch || fileMatch) && !matchedSet.has(policy.id)) {
                    matchedSet.add(policy.id);
                    result.push(policy);
                }
            }
        }
        // 추가 검색: 컴포넌트명, API 경로에서 키워드 매칭 -> 해당 파일의 정책
        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();
            // 컴포넌트명 매칭
            for (const comp of codeIndex.components) {
                if (comp.name.toLowerCase().includes(lowerKeyword)) {
                    const compPolicies = codeIndex.policies.filter(p => p.filePath === comp.filePath && !matchedSet.has(p.id));
                    for (const p of compPolicies) {
                        matchedSet.add(p.id);
                        result.push(p);
                    }
                }
            }
            // API 경로 매칭
            for (const api of codeIndex.apis) {
                if (api.path.toLowerCase().includes(lowerKeyword)) {
                    const apiPolicies = codeIndex.policies.filter(p => p.filePath === api.filePath && !matchedSet.has(p.id));
                    for (const p of apiPolicies) {
                        matchedSet.add(p.id);
                        result.push(p);
                    }
                }
            }
        }
        return result;
    }
    /**
     * 정책과 관련된 파일 목록 수집
     */
    getFilesForPolicy(codeIndex, policy) {
        const files = new Set();
        files.add(policy.filePath);
        // 관련 컴포넌트의 파일 추가
        for (const compId of policy.relatedComponents) {
            const comp = codeIndex.components.find(c => c.id === compId);
            if (comp) {
                files.add(comp.filePath);
            }
        }
        // 관련 API의 파일 추가
        for (const apiId of policy.relatedApis) {
            const api = codeIndex.apis.find(a => a.id === apiId);
            if (api) {
                files.add(api.filePath);
            }
        }
        return Array.from(files);
    }
    /**
     * 기획자 체크리스트 생성
     */
    generateChecklist(matchedPolicies, _changeDesc) {
        const checklist = [];
        checklist.push('변경 사항이 기존 정책의 조건/기준값에 영향을 주는지 확인');
        const categories = new Set(matchedPolicies.map(p => p.category));
        for (const category of categories) {
            checklist.push(`"${category}" 카테고리의 다른 정책과 충돌 여부 확인`);
        }
        checklist.push('관련 테스트 케이스 업데이트 필요 여부 확인');
        checklist.push('변경 후 회귀 테스트 수행');
        if (matchedPolicies.some(p => p.relatedComponents.length > 0)) {
            checklist.push('영향받는 UI 컴포넌트의 표시 변경 확인');
        }
        if (matchedPolicies.some(p => p.relatedApis.length > 0)) {
            checklist.push('영향받는 API 응답 스펙 변경 여부 확인');
        }
        return checklist;
    }
}
exports.PolicyCheckCommand = PolicyCheckCommand;
/**
 * 프로젝트 미설정/미존재 에러
 */
class ProjectNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProjectNotFoundError';
    }
}
//# sourceMappingURL=policy-check.js.map