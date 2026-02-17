"use strict";
/**
 * @module commands/summary
 * @description Summary 명령어 핸들러 - 프로젝트 요약 정보
 *
 * 기능:
 *   - 전체 프로젝트 통계 (기본 동작)
 *   - --system <name>: 특정 시스템(모듈) 상세 요약
 *   - --recent: Git log 기반 최근 변경 요약
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
exports.SummaryCommand = void 0;
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const indexer_1 = require("../core/indexing/indexer");
const annotation_loader_1 = require("../core/annotations/annotation-loader");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * SummaryCommand - 프로젝트 요약 정보 명령어
 *
 * 사용법:
 *   /impact summary                     - 전체 프로젝트 통계
 *   /impact summary --system <name>     - 특정 시스템 상세 요약
 *   /impact summary --recent            - 최근 변경 요약
 */
class SummaryCommand {
    constructor(args) {
        this.name = 'summary';
        this.description = '프로젝트 요약 정보';
        this.args = args;
    }
    async execute() {
        try {
            // 1. 활성 프로젝트 확인
            const { projectId, projectPath } = await this.getActiveProject();
            // 2. 인덱스 로드
            const indexer = new indexer_1.Indexer();
            const codeIndex = await indexer.loadIndex(projectId);
            if (!codeIndex) {
                logger_1.logger.error('인덱스가 없습니다. 먼저 reindex를 실행해주세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: '인덱스가 없습니다. 먼저 reindex를 실행해주세요.',
                };
            }
            // 옵션 파싱
            const systemIdx = this.args.indexOf('--system');
            const recentIdx = this.args.indexOf('--recent');
            if (systemIdx !== -1) {
                const systemName = this.args[systemIdx + 1];
                if (!systemName) {
                    logger_1.logger.error('시스템명을 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: '시스템명을 지정해주세요. 예: --system cart',
                    };
                }
                return this.handleSystemSummary(codeIndex, systemName);
            }
            if (recentIdx !== -1) {
                return this.handleRecentChanges(codeIndex, projectPath);
            }
            // 기본: 전체 프로젝트 통계
            return this.handleProjectSummary(codeIndex, projectId);
        }
        catch (err) {
            if (err instanceof ProjectNotFoundError) {
                return {
                    code: common_1.ResultCode.NEEDS_CONFIG,
                    message: err.message,
                };
            }
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`프로젝트 요약 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Summary failed: ${errorMsg}`,
            };
        }
    }
    // ============================================================
    // 전체 프로젝트 통계 (기본 동작)
    // ============================================================
    async handleProjectSummary(codeIndex, projectId) {
        const { meta } = codeIndex;
        logger_1.logger.header('프로젝트 요약');
        console.log(`\n  프로젝트: ${meta.project.name}`);
        console.log(`  경로: ${meta.project.path}`);
        console.log(`  기술 스택: ${meta.project.techStack.join(', ')}`);
        console.log(`  패키지 매니저: ${meta.project.packageManager}`);
        console.log(`  마지막 인덱싱: ${meta.updatedAt}`);
        if (meta.lastUpdateType) {
            console.log(`  인덱싱 방식: ${meta.lastUpdateType}`);
        }
        console.log('');
        console.log('  [코드 통계]');
        console.log(`    파일 수: ${meta.stats.totalFiles}`);
        console.log(`    화면 수: ${meta.stats.screens}`);
        console.log(`    컴포넌트 수: ${meta.stats.components}`);
        console.log(`    API 수: ${meta.stats.apiEndpoints}`);
        console.log(`    모델 수: ${meta.stats.models}`);
        console.log(`    모듈 수: ${meta.stats.modules}`);
        console.log(`    정책 수: ${codeIndex.policies.length}`);
        // 의존성 그래프 정보
        const graph = codeIndex.dependencies.graph;
        console.log('');
        console.log('  [의존성 그래프]');
        console.log(`    노드 수: ${graph.nodes.length}`);
        console.log(`    엣지 수: ${graph.edges.length}`);
        // Git 정보
        console.log('');
        console.log('  [Git 정보]');
        console.log(`    브랜치: ${meta.gitBranch}`);
        console.log(`    커밋: ${meta.gitCommit}`);
        // 보강 주석 상태
        let annotationStatus = '미생성';
        let annotationMeta = null;
        try {
            const loader = new annotation_loader_1.AnnotationLoader();
            annotationMeta = await loader.getProjectMeta(projectId);
            if (annotationMeta) {
                annotationStatus = `생성됨 (파일 ${annotationMeta.totalFiles}개, 주석 ${annotationMeta.totalAnnotations}개, 정책 ${annotationMeta.totalPolicies}개)`;
            }
        }
        catch {
            // 보강 주석 로드 실패 시 무시
        }
        console.log('');
        console.log('  [보강 주석]');
        console.log(`    상태: ${annotationStatus}`);
        if (annotationMeta) {
            console.log(`    평균 신뢰도: ${(annotationMeta.avgConfidence * 100).toFixed(1)}%`);
            console.log(`    사용자 수정: ${annotationMeta.userModifiedCount}건`);
        }
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `프로젝트 요약: ${meta.project.name}`,
            data: {
                projectName: meta.project.name,
                stats: meta.stats,
                policies: codeIndex.policies.length,
                graph: { nodes: graph.nodes.length, edges: graph.edges.length },
                gitBranch: meta.gitBranch,
                gitCommit: meta.gitCommit,
                annotationStatus,
                annotationMeta,
            },
        };
    }
    // ============================================================
    // --system: 시스템별 상세 요약
    // ============================================================
    handleSystemSummary(codeIndex, systemName) {
        const lowerName = systemName.toLowerCase();
        // 시스템에 해당하는 항목 필터링
        // 파일 경로, 컴포넌트명, API 경로, 정책 카테고리/모듈에서 매칭
        const matchedFiles = codeIndex.files.filter(f => f.path.toLowerCase().includes(lowerName));
        const matchedComponents = codeIndex.components.filter(c => c.name.toLowerCase().includes(lowerName) ||
            c.filePath.toLowerCase().includes(lowerName));
        const matchedApis = codeIndex.apis.filter(a => a.path.toLowerCase().includes(lowerName) ||
            a.handler.toLowerCase().includes(lowerName) ||
            a.filePath.toLowerCase().includes(lowerName));
        const matchedScreens = codeIndex.screens.filter(s => s.name.toLowerCase().includes(lowerName) ||
            s.route.toLowerCase().includes(lowerName) ||
            s.filePath.toLowerCase().includes(lowerName));
        const matchedPolicies = codeIndex.policies.filter(p => p.name.toLowerCase().includes(lowerName) ||
            p.category.toLowerCase().includes(lowerName) ||
            p.filePath.toLowerCase().includes(lowerName) ||
            p.relatedModules.some(m => m.toLowerCase().includes(lowerName)));
        const totalMatches = matchedFiles.length + matchedComponents.length +
            matchedApis.length + matchedScreens.length + matchedPolicies.length;
        if (totalMatches === 0) {
            // 사용 가능한 시스템 목록 추출
            const systems = this.extractAvailableSystems(codeIndex);
            logger_1.logger.header(`시스템 요약: "${systemName}"`);
            console.log(`\n  해당 시스템을 찾을 수 없습니다: "${systemName}"`);
            console.log('');
            if (systems.length > 0) {
                console.log('  사용 가능한 시스템 목록:');
                for (const sys of systems) {
                    console.log(`    - ${sys}`);
                }
                console.log('');
            }
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `해당 시스템을 찾을 수 없습니다: "${systemName}"`,
                data: { systemName, availableSystems: systems },
            };
        }
        logger_1.logger.header(`시스템 요약: "${systemName}"`);
        console.log(`\n  [통계]`);
        console.log(`    파일 수: ${matchedFiles.length}`);
        console.log(`    화면 수: ${matchedScreens.length}`);
        console.log(`    컴포넌트 수: ${matchedComponents.length}`);
        console.log(`    API 수: ${matchedApis.length}`);
        console.log(`    정책 수: ${matchedPolicies.length}`);
        console.log('');
        // 주요 파일 목록 (상위 10개)
        const topFiles = matchedFiles.slice(0, 10);
        if (topFiles.length > 0) {
            console.log('  [주요 파일]');
            for (const file of topFiles) {
                console.log(`    - ${file.path}`);
            }
            if (matchedFiles.length > 10) {
                console.log(`    ... 외 ${matchedFiles.length - 10}개`);
            }
            console.log('');
        }
        if (matchedComponents.length > 0) {
            console.log('  [컴포넌트]');
            for (const comp of matchedComponents) {
                console.log(`    - ${comp.name} (${comp.filePath})`);
            }
            console.log('');
        }
        if (matchedApis.length > 0) {
            console.log('  [API]');
            for (const api of matchedApis) {
                console.log(`    - ${api.method} ${api.path} (${api.filePath})`);
            }
            console.log('');
        }
        if (matchedPolicies.length > 0) {
            console.log('  [정책]');
            for (const policy of matchedPolicies) {
                console.log(`    - ${policy.name}: ${policy.description}`);
            }
            console.log('');
        }
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `시스템 요약: "${systemName}" - ${totalMatches}개 항목`,
            data: {
                systemName,
                files: matchedFiles.length,
                screens: matchedScreens.length,
                components: matchedComponents.length,
                apis: matchedApis.length,
                policies: matchedPolicies.length,
            },
        };
    }
    // ============================================================
    // --recent: 최근 변경 요약
    // ============================================================
    async handleRecentChanges(codeIndex, projectPath) {
        logger_1.logger.header('최근 변경 요약');
        try {
            const { simpleGit } = await Promise.resolve().then(() => __importStar(require('simple-git')));
            const git = simpleGit(projectPath);
            // 최근 10개 커밋
            const log = await git.log({ maxCount: 10 });
            if (!log.all || log.all.length === 0) {
                console.log('\n  Git 커밋 이력이 없습니다.');
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: 'Git 커밋 이력이 없습니다.',
                    data: { commits: [] },
                };
            }
            console.log(`\n  최근 ${log.all.length}개 커밋:\n`);
            const commitSummaries = [];
            for (const commit of log.all) {
                const shortHash = commit.hash.substring(0, 7);
                const shortMessage = commit.message.split('\n')[0];
                console.log(`  ${shortHash} ${shortMessage}`);
                console.log(`    작성자: ${commit.author_name} | ${commit.date}`);
                // 커밋별 변경 파일 조회
                let changedFiles = [];
                try {
                    const diff = await git.diff(['--name-only', `${commit.hash}^`, commit.hash]);
                    changedFiles = diff.split('\n').filter(f => f.trim().length > 0);
                }
                catch {
                    // 첫 번째 커밋 등 diff 실패 시 무시
                }
                // 변경 파일과 인덱스 매핑
                const affectedComponents = [];
                const affectedApis = [];
                const affectedPolicies = [];
                for (const filePath of changedFiles) {
                    // 컴포넌트 매핑
                    for (const comp of codeIndex.components) {
                        if (comp.filePath === filePath && !affectedComponents.includes(comp.name)) {
                            affectedComponents.push(comp.name);
                        }
                    }
                    // API 매핑
                    for (const api of codeIndex.apis) {
                        if (api.filePath === filePath) {
                            const apiName = `${api.method} ${api.path}`;
                            if (!affectedApis.includes(apiName)) {
                                affectedApis.push(apiName);
                            }
                        }
                    }
                    // 정책 매핑
                    for (const policy of codeIndex.policies) {
                        if (policy.filePath === filePath && !affectedPolicies.includes(policy.name)) {
                            affectedPolicies.push(policy.name);
                        }
                    }
                }
                if (affectedComponents.length > 0) {
                    console.log(`    영향 컴포넌트: ${affectedComponents.join(', ')}`);
                }
                if (affectedApis.length > 0) {
                    console.log(`    영향 API: ${affectedApis.join(', ')}`);
                }
                if (affectedPolicies.length > 0) {
                    console.log(`    영향 정책: ${affectedPolicies.join(', ')}`);
                }
                console.log('');
                commitSummaries.push({
                    hash: commit.hash,
                    message: shortMessage,
                    date: commit.date,
                    author: commit.author_name,
                    affectedComponents,
                    affectedApis,
                    affectedPolicies,
                });
            }
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `최근 변경 요약: ${log.all.length}개 커밋`,
                data: { commits: commitSummaries },
            };
        }
        catch {
            console.log('\n  Git 정보를 사용할 수 없습니다.');
            console.log('  프로젝트가 Git으로 관리되고 있는지 확인해주세요.');
            console.log('');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'Git 정보를 사용할 수 없습니다.',
                data: { commits: [], gitAvailable: false },
            };
        }
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
     * 인덱스에서 사용 가능한 시스템(모듈) 이름 목록을 추출한다.
     * 파일 경로의 최상위 디렉토리, 컴포넌트 타입, 정책 카테고리 등에서 추출
     */
    extractAvailableSystems(codeIndex) {
        const systemSet = new Set();
        // 파일 경로에서 주요 디렉토리 추출 (src/ 다음 디렉토리)
        for (const file of codeIndex.files) {
            const parts = file.path.split('/');
            const srcIdx = parts.indexOf('src');
            if (srcIdx !== -1 && parts.length > srcIdx + 1) {
                systemSet.add(parts[srcIdx + 1]);
            }
        }
        // 정책 카테고리
        for (const policy of codeIndex.policies) {
            if (policy.category) {
                systemSet.add(policy.category);
            }
        }
        // 정책 관련 모듈
        for (const policy of codeIndex.policies) {
            for (const mod of policy.relatedModules) {
                systemSet.add(mod);
            }
        }
        return Array.from(systemSet).sort();
    }
}
exports.SummaryCommand = SummaryCommand;
/**
 * 프로젝트 미설정/미존재 에러
 */
class ProjectNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProjectNotFoundError';
    }
}
//# sourceMappingURL=summary.js.map