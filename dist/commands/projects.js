"use strict";
/**
 * @module commands/projects
 * @description Projects 명령어 핸들러 - 멀티 프로젝트 관리
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
exports.ProjectsCommand = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const file_1 = require("../utils/file");
const result_manager_1 = require("../core/analysis/result-manager");
const cross_project_manager_1 = require("../core/cross-project/cross-project-manager");
const indexer_1 = require("../core/indexing/indexer");
const logger_1 = require("../utils/logger");
/**
 * ProjectsCommand - 프로젝트 관리 명령어
 *
 * 사용법:
 *   /impact projects                  - 프로젝트 목록 조회
 *   /impact projects --switch <name>  - 활성 프로젝트 전환
 *   /impact projects --remove <name>  - 프로젝트 등록 해제
 *   /impact projects --info <name>    - 프로젝트 상세 조회
 *   /impact projects --link <source> <target> --type <type>  - 의존성 등록
 *   /impact projects --unlink <source> <target>              - 의존성 해제
 *   /impact projects --links [projectId]                     - 의존성 목록 조회
 *   /impact projects --detect-links                          - API 경로 기반 자동 의존성 감지
 *   /impact projects --group <name> --add <project-id>       - 그룹에 프로젝트 추가
 *   /impact projects --group <name> --remove <project-id>    - 그룹에서 프로젝트 제거
 *   /impact projects --groups                                - 전체 그룹 목록 조회
 */
class ProjectsCommand {
    constructor(args) {
        this.name = 'projects';
        this.description = '멀티 프로젝트를 관리합니다.';
        this.args = args;
    }
    async execute() {
        try {
            const projectsPath = path.join((0, file_1.getImpactDir)(), 'projects.json');
            const config = this.loadProjectsConfig(projectsPath);
            // --groups 처리 (목록 조회 - --group보다 먼저 체크)
            const groupsIdx = this.args.indexOf('--groups');
            if (groupsIdx !== -1) {
                return await this.handleGroupsList();
            }
            // --group 처리 (추가/제거 - --remove, --add와 조합되므로 단독 --remove보다 먼저 처리)
            const groupIdx = this.args.indexOf('--group');
            if (groupIdx !== -1) {
                return await this.handleGroup();
            }
            // --switch 처리
            const switchIdx = this.args.indexOf('--switch');
            if (switchIdx !== -1) {
                const projectName = this.args[switchIdx + 1];
                if (!projectName) {
                    logger_1.logger.error('전환할 프로젝트 이름을 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: 'Project name is required for --switch.',
                    };
                }
                return this.handleSwitch(projectsPath, config, projectName);
            }
            // --remove 처리
            const removeIdx = this.args.indexOf('--remove');
            if (removeIdx !== -1) {
                const projectName = this.args[removeIdx + 1];
                if (!projectName) {
                    logger_1.logger.error('제거할 프로젝트 이름을 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: 'Project name is required for --remove.',
                    };
                }
                return this.handleRemove(projectsPath, config, projectName);
            }
            // --info 처리
            const infoIdx = this.args.indexOf('--info');
            if (infoIdx !== -1) {
                const projectName = this.args[infoIdx + 1];
                if (!projectName) {
                    logger_1.logger.error('조회할 프로젝트 이름을 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: 'Project name is required for --info.',
                    };
                }
                return await this.handleInfo(config, projectName);
            }
            // --link 처리
            const linkIdx = this.args.indexOf('--link');
            if (linkIdx !== -1) {
                return await this.handleLink();
            }
            // --unlink 처리
            const unlinkIdx = this.args.indexOf('--unlink');
            if (unlinkIdx !== -1) {
                return await this.handleUnlink();
            }
            // --links 처리
            const linksIdx = this.args.indexOf('--links');
            if (linksIdx !== -1) {
                return await this.handleLinks();
            }
            // --detect-links 처리
            const detectLinksIdx = this.args.indexOf('--detect-links');
            if (detectLinksIdx !== -1) {
                return await this.handleDetectLinks(config);
            }
            // 기본: 목록 조회
            return this.handleList(config);
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`프로젝트 관리 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Projects command failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 프로젝트 목록 조회
     */
    handleList(config) {
        logger_1.logger.header('프로젝트 목록');
        if (config.projects.length === 0) {
            console.log('\n등록된 프로젝트가 없습니다.');
            console.log('프로젝트 등록: /impact init <project_path>');
        }
        else {
            console.log('');
            for (const project of config.projects) {
                const activeMarker = project.id === config.activeProject ? ' (활성)' : '';
                const statusLabel = project.status === 'archived' ? ' [아카이브]' : '';
                const domainTags = project.domains && project.domains.length > 0
                    ? ' ' + project.domains.map(d => `[${d}]`).join(' ')
                    : '';
                console.log(`  ${project.id.padEnd(24)} ${project.name}${activeMarker}${statusLabel}${domainTags}`);
            }
            console.log(`\n총 ${config.projects.length}개의 프로젝트가 등록되어 있습니다.`);
            console.log(`활성 프로젝트: ${config.activeProject || '(없음)'}`);
        }
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Listed ${config.projects.length} projects.`,
            data: { projects: config.projects, activeProject: config.activeProject },
        };
    }
    /**
     * 활성 프로젝트 전환
     */
    handleSwitch(projectsPath, config, projectName) {
        // ID 또는 이름으로 검색
        const project = config.projects.find(p => p.id === projectName || p.name === projectName);
        if (!project) {
            logger_1.logger.error(`프로젝트를 찾을 수 없습니다: ${projectName}`);
            console.log('\n등록된 프로젝트:');
            for (const p of config.projects) {
                console.log(`  - ${p.id} (${p.name})`);
            }
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Project not found: ${projectName}`,
            };
        }
        config.activeProject = project.id;
        project.lastUsedAt = new Date().toISOString();
        (0, file_1.writeJsonFile)(projectsPath, config);
        logger_1.logger.success(`활성 프로젝트가 전환되었습니다: ${project.name} (${project.id})`);
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Switched to project: ${project.id}`,
            data: { activeProject: project.id },
        };
    }
    /**
     * 프로젝트 등록 해제 (파일은 유지, projects.json에서만 제거)
     */
    handleRemove(projectsPath, config, projectName) {
        const idx = config.projects.findIndex(p => p.id === projectName || p.name === projectName);
        if (idx === -1) {
            logger_1.logger.error(`프로젝트를 찾을 수 없습니다: ${projectName}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Project not found: ${projectName}`,
            };
        }
        const removed = config.projects.splice(idx, 1)[0];
        // 활성 프로젝트가 삭제된 경우 초기화
        if (config.activeProject === removed.id) {
            config.activeProject = config.projects.length > 0 ? config.projects[0].id : '';
        }
        (0, file_1.writeJsonFile)(projectsPath, config);
        logger_1.logger.success(`프로젝트가 등록 해제되었습니다: ${removed.name} (${removed.id})`);
        console.log('참고: 프로젝트 파일은 유지됩니다. 완전 삭제하려면 직접 디렉토리를 삭제하세요.');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Project removed: ${removed.id}`,
            data: { removed },
        };
    }
    /**
     * 프로젝트 상세 조회
     */
    async handleInfo(config, projectName) {
        const project = config.projects.find(p => p.id === projectName || p.name === projectName);
        if (!project) {
            logger_1.logger.error(`프로젝트를 찾을 수 없습니다: ${projectName}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Project not found: ${projectName}`,
            };
        }
        // 인덱스 파일 수 확인
        const indexDir = path.join((0, file_1.getProjectDir)(project.id), 'index');
        let indexedFileCount = 0;
        try {
            const filesJsonPath = path.join(indexDir, 'files.json');
            if (fs.existsSync(filesJsonPath)) {
                const files = (0, file_1.readJsonFile)(filesJsonPath);
                indexedFileCount = files ? files.length : 0;
            }
        }
        catch {
            // 인덱스 파일 없음
        }
        // 최신 분석 결과 확인
        const resultManager = new result_manager_1.ResultManager();
        const results = await resultManager.list(project.id);
        const latestAnalysis = results.length > 0
            ? results.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())[0]
            : null;
        const isActive = config.activeProject === project.id;
        logger_1.logger.header(`프로젝트 상세 - ${project.name}`);
        console.log(`\n  ID:         ${project.id}`);
        console.log(`  이름:       ${project.name}`);
        console.log(`  경로:       ${project.path}`);
        console.log(`  상태:       ${project.status}${isActive ? ' (활성)' : ''}`);
        console.log(`  기술 스택:  ${project.techStack.length > 0 ? project.techStack.join(', ') : '(미감지)'}`);
        if (project.domains && project.domains.length > 0) {
            console.log(`  도메인:     ${project.domains.map(d => `[${d}]`).join(' ')}`);
        }
        console.log(`  인덱스 파일: ${indexedFileCount}개`);
        console.log(`  분석 결과:  ${results.length}건`);
        if (latestAnalysis) {
            console.log(`  최근 분석:  ${latestAnalysis.specTitle} (${latestAnalysis.analyzedAt})`);
        }
        if (project.featureSummary && project.featureSummary.length > 0) {
            console.log('\n  주요 기능:');
            for (const summary of project.featureSummary) {
                console.log(`    - ${summary}`);
            }
        }
        console.log(`\n  생성:       ${project.createdAt}`);
        console.log(`  마지막 사용: ${project.lastUsedAt}`);
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Showing project info: ${project.id}`,
            data: { project, indexedFileCount, analysisCount: results.length },
        };
    }
    /**
     * 크로스 프로젝트 의존성 등록
     */
    async handleLink() {
        const linkIdx = this.args.indexOf('--link');
        const source = this.args[linkIdx + 1];
        const target = this.args[linkIdx + 2];
        if (!source || !target) {
            logger_1.logger.error('소스와 대상 프로젝트 ID를 지정해주세요.');
            return {
                code: common_1.ResultCode.FAILURE,
                message: 'Source and target project IDs are required for --link.',
            };
        }
        const typeIdx = this.args.indexOf('--type');
        const typeStr = typeIdx !== -1 ? this.args[typeIdx + 1] : undefined;
        const validTypes = [
            'api-consumer', 'api-provider', 'shared-library',
            'shared-types', 'event-publisher', 'event-subscriber',
        ];
        if (!typeStr || !validTypes.includes(typeStr)) {
            logger_1.logger.error(`유효한 의존성 유형을 지정해주세요: ${validTypes.join(', ')}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Valid --type is required. Options: ${validTypes.join(', ')}`,
            };
        }
        const manager = new cross_project_manager_1.CrossProjectManager();
        const link = await manager.link(source, target, typeStr);
        logger_1.logger.header('의존성 등록');
        console.log(`\n  ${link.source} -> ${link.target} (${link.type})`);
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Link created: ${link.source} -> ${link.target}`,
            data: { link },
        };
    }
    /**
     * 크로스 프로젝트 의존성 해제
     */
    async handleUnlink() {
        const unlinkIdx = this.args.indexOf('--unlink');
        const source = this.args[unlinkIdx + 1];
        const target = this.args[unlinkIdx + 2];
        if (!source || !target) {
            logger_1.logger.error('소스와 대상 프로젝트 ID를 지정해주세요.');
            return {
                code: common_1.ResultCode.FAILURE,
                message: 'Source and target project IDs are required for --unlink.',
            };
        }
        const manager = new cross_project_manager_1.CrossProjectManager();
        const removed = await manager.unlink(source, target);
        if (!removed) {
            logger_1.logger.error(`의존성을 찾을 수 없습니다: ${source} <-> ${target}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Link not found: ${source} <-> ${target}`,
            };
        }
        logger_1.logger.success(`의존성 해제 완료: ${source} <-> ${target}`);
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Link removed: ${source} <-> ${target}`,
            data: { source, target },
        };
    }
    /**
     * 크로스 프로젝트 의존성 목록 조회
     */
    async handleLinks() {
        const linksIdx = this.args.indexOf('--links');
        const projectId = this.args[linksIdx + 1];
        const manager = new cross_project_manager_1.CrossProjectManager();
        const links = await manager.getLinks(projectId);
        logger_1.logger.header('프로젝트 의존성 목록');
        if (links.length === 0) {
            console.log('\n등록된 의존성이 없습니다.');
            console.log('의존성 등록: /impact projects --link <source> <target> --type <type>');
        }
        else {
            console.log('');
            for (const link of links) {
                const apiInfo = link.apis && link.apis.length > 0
                    ? ` [APIs: ${link.apis.join(', ')}]`
                    : '';
                console.log(`  ${link.source} -> ${link.target} (${link.type})${apiInfo}`);
            }
            console.log(`\n총 ${links.length}개의 의존성이 등록되어 있습니다.`);
        }
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Listed ${links.length} links.`,
            data: { links },
        };
    }
    /**
     * API 경로 기반 자동 의존성 감지
     */
    async handleDetectLinks(config) {
        const projectIds = config.projects.map(p => p.id);
        if (projectIds.length < 2) {
            logger_1.logger.warn('의존성 감지에는 최소 2개의 등록된 프로젝트가 필요합니다.');
            console.log('\n등록된 프로젝트가 부족합니다 (최소 2개 필요).');
            console.log('프로젝트 등록: /impact init <project_path>');
            console.log('');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'Not enough projects for detect-links (minimum 2 required).',
                data: { detectedLinks: [] },
            };
        }
        const indexer = new indexer_1.Indexer();
        const manager = new cross_project_manager_1.CrossProjectManager();
        const detectedLinks = await manager.detectLinks(indexer, projectIds);
        logger_1.logger.header('자동 의존성 감지 결과');
        if (detectedLinks.length === 0) {
            console.log('\n감지된 의존성이 없습니다.');
            console.log('프로젝트들의 인덱스가 최신인지 확인해주세요: /impact reindex');
        }
        else {
            console.log('');
            for (const link of detectedLinks) {
                const apiInfo = link.apis && link.apis.length > 0
                    ? ` [APIs: ${link.apis.join(', ')}]`
                    : '';
                console.log(`  ${link.source} -> ${link.target} (${link.type})${apiInfo}`);
            }
            console.log(`\n총 ${detectedLinks.length}개의 의존성이 감지되었습니다.`);
            console.log('이 의존성을 등록하시겠습니까?');
            console.log('등록: /impact projects --link <source> <target> --type <type>');
        }
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Detected ${detectedLinks.length} links.`,
            data: { detectedLinks },
        };
    }
    /**
     * 그룹 목록 조회
     */
    async handleGroupsList() {
        const manager = new cross_project_manager_1.CrossProjectManager();
        const groups = await manager.getGroups();
        logger_1.logger.header('프로젝트 그룹 목록');
        if (groups.length === 0) {
            console.log('\n등록된 그룹이 없습니다.');
            console.log('그룹 추가: /impact projects --group <name> --add <project-id>');
        }
        else {
            console.log('');
            for (const group of groups) {
                console.log(`  ${group.name}: ${group.projects.length > 0 ? group.projects.join(', ') : '(비어있음)'}`);
            }
            console.log(`\n총 ${groups.length}개의 그룹이 등록되어 있습니다.`);
        }
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Listed ${groups.length} groups.`,
            data: { groups },
        };
    }
    /**
     * 그룹에 프로젝트 추가/제거
     */
    async handleGroup() {
        const groupIdx = this.args.indexOf('--group');
        const groupName = this.args[groupIdx + 1];
        if (!groupName) {
            logger_1.logger.error('그룹 이름을 지정해주세요.');
            return {
                code: common_1.ResultCode.FAILURE,
                message: 'Group name is required for --group.',
            };
        }
        const manager = new cross_project_manager_1.CrossProjectManager();
        // --add 처리
        const addIdx = this.args.indexOf('--add');
        if (addIdx !== -1) {
            const projectId = this.args[addIdx + 1];
            if (!projectId) {
                logger_1.logger.error('추가할 프로젝트 ID를 지정해주세요.');
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: 'Project ID is required for --add.',
                };
            }
            const existingGroup = await manager.getGroup(groupName);
            const projects = existingGroup ? [...existingGroup.projects] : [];
            if (!projects.includes(projectId)) {
                projects.push(projectId);
            }
            const group = await manager.addGroup(groupName, projects);
            logger_1.logger.success(`그룹 '${groupName}'에 프로젝트 '${projectId}'를 추가했습니다.`);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Added ${projectId} to group ${groupName}.`,
                data: { group },
            };
        }
        // --remove 처리
        const removeIdx = this.args.indexOf('--remove');
        if (removeIdx !== -1) {
            const projectId = this.args[removeIdx + 1];
            if (!projectId) {
                logger_1.logger.error('제거할 프로젝트 ID를 지정해주세요.');
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: 'Project ID is required for --remove.',
                };
            }
            const existingGroup = await manager.getGroup(groupName);
            if (!existingGroup) {
                logger_1.logger.error(`그룹을 찾을 수 없습니다: ${groupName}`);
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: `Group not found: ${groupName}`,
                };
            }
            const projects = existingGroup.projects.filter(p => p !== projectId);
            const group = await manager.addGroup(groupName, projects);
            logger_1.logger.success(`그룹 '${groupName}'에서 프로젝트 '${projectId}'를 제거했습니다.`);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Removed ${projectId} from group ${groupName}.`,
                data: { group },
            };
        }
        // --add, --remove 없이 --group만 사용한 경우
        logger_1.logger.error('--add 또는 --remove 옵션을 지정해주세요.');
        return {
            code: common_1.ResultCode.FAILURE,
            message: '--add or --remove is required with --group.',
        };
    }
    /**
     * 프로젝트 설정 로드
     */
    loadProjectsConfig(projectsPath) {
        const config = (0, file_1.readJsonFile)(projectsPath);
        return config || { activeProject: '', projects: [] };
    }
}
exports.ProjectsCommand = ProjectsCommand;
//# sourceMappingURL=projects.js.map