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
const logger_1 = require("../utils/logger");
/**
 * ProjectsCommand - 프로젝트 관리 명령어
 *
 * 사용법:
 *   /impact projects                  - 프로젝트 목록 조회
 *   /impact projects --switch <name>  - 활성 프로젝트 전환
 *   /impact projects --remove <name>  - 프로젝트 등록 해제
 *   /impact projects --info <name>    - 프로젝트 상세 조회
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
                console.log(`  ${project.id.padEnd(24)} ${project.name}${activeMarker}${statusLabel}`);
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
        console.log(`  인덱스 파일: ${indexedFileCount}개`);
        console.log(`  분석 결과:  ${results.length}건`);
        if (latestAnalysis) {
            console.log(`  최근 분석:  ${latestAnalysis.specTitle} (${latestAnalysis.analyzedAt})`);
        }
        console.log(`  생성:       ${project.createdAt}`);
        console.log(`  마지막 사용: ${project.lastUsedAt}`);
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Showing project info: ${project.id}`,
            data: { project, indexedFileCount, analysisCount: results.length },
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