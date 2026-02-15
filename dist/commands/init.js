"use strict";
/**
 * @module commands/init
 * @description Init 명령어 핸들러 - 프로젝트를 등록하고 코드 인덱싱을 수행
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
exports.InitCommand = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const indexer_1 = require("../core/indexing/indexer");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * InitCommand - 프로젝트 초기화 명령어
 *
 * 사용법: /impact init <project_path>
 * 기능:
 *   - 프로젝트 경로 유효성 검증
 *   - 기술 스택 자동 감지 및 표시
 *   - 전체 인덱싱 실행
 *   - 인덱스 결과 요약 출력
 *   - .impact/ 디렉토리에 저장
 */
class InitCommand {
    /**
     * InitCommand 생성
     * @param args - 명령어 인자
     */
    constructor(args) {
        this.name = 'init';
        this.description = '프로젝트를 등록하고 코드 인덱싱을 수행합니다.';
        this.args = args;
    }
    /**
     * 명령어 실행
     * @returns 실행 결과
     */
    async execute() {
        const projectPath = this.args[0];
        if (!projectPath) {
            logger_1.logger.error('프로젝트 경로를 지정해 주세요.');
            console.log('\n사용법: /impact init <project_path>');
            console.log('예시:   /impact init /path/to/your/project');
            return {
                code: common_1.ResultCode.FAILURE,
                message: 'Project path is required.',
            };
        }
        const resolvedPath = path.resolve(projectPath);
        // 경로 유효성 검증
        if (!fs.existsSync(resolvedPath)) {
            logger_1.logger.error(`경로가 존재하지 않습니다: ${resolvedPath}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `❌ 경로가 존재하지 않습니다: ${resolvedPath}`,
            };
        }
        if (!fs.statSync(resolvedPath).isDirectory()) {
            logger_1.logger.error(`디렉토리가 아닙니다: ${resolvedPath}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Not a directory: ${resolvedPath}`,
            };
        }
        try {
            logger_1.logger.header('Impact Checker - 프로젝트 초기화');
            // 프로젝트 ID 생성
            const projectName = path.basename(resolvedPath);
            const projectId = (0, file_1.toKebabCase)(projectName);
            console.log(`\n프로젝트: ${projectName}`);
            console.log(`경로: ${resolvedPath}`);
            console.log(`ID: ${projectId}`);
            // 인덱싱 실행
            console.log('\n인덱싱을 시작합니다...\n');
            const indexer = new indexer_1.Indexer();
            const codeIndex = await indexer.fullIndex(resolvedPath);
            // 인덱스 저장
            await indexer.saveIndex(codeIndex, projectId);
            // 프로젝트 등록
            this.registerProject(projectId, projectName, resolvedPath, codeIndex.meta.project.techStack);
            // 결과 요약 출력
            logger_1.logger.separator();
            console.log('\n인덱싱 결과 요약:');
            console.log(`  파일 수:       ${codeIndex.meta.stats.totalFiles}`);
            console.log(`  화면 수:       ${codeIndex.meta.stats.screens}`);
            console.log(`  컴포넌트 수:   ${codeIndex.meta.stats.components}`);
            console.log(`  API 엔드포인트: ${codeIndex.meta.stats.apiEndpoints}`);
            console.log(`  모듈 수:       ${codeIndex.meta.stats.modules}`);
            console.log(`  정책 수:       ${codeIndex.policies.length}`);
            if (codeIndex.meta.project.techStack.length > 0) {
                console.log(`\n기술 스택: ${codeIndex.meta.project.techStack.join(', ')}`);
            }
            console.log(`\nGit: ${codeIndex.meta.gitBranch} (${codeIndex.meta.gitCommit.substring(0, 7)})`);
            logger_1.logger.separator();
            logger_1.logger.success('프로젝트 초기화가 완료되었습니다!');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Project initialized: ${projectId}`,
                data: {
                    projectId,
                    stats: codeIndex.meta.stats,
                    techStack: codeIndex.meta.project.techStack,
                },
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`초기화 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Initialization failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 프로젝트를 .impact/projects.json에 등록
     */
    registerProject(projectId, name, projectPath, techStack) {
        const impactDir = (0, file_1.getImpactDir)();
        (0, file_1.ensureDir)(impactDir);
        const projectsPath = path.join(impactDir, 'projects.json');
        const config = (0, file_1.readJsonFile)(projectsPath) || {
            activeProject: '',
            projects: [],
        };
        // 기존 프로젝트 업데이트 또는 신규 등록
        const now = new Date().toISOString();
        const existingIdx = config.projects.findIndex(p => p.id === projectId);
        const entry = {
            id: projectId,
            name,
            path: projectPath,
            status: 'active',
            createdAt: existingIdx >= 0 ? config.projects[existingIdx].createdAt : now,
            lastUsedAt: now,
            techStack,
        };
        if (existingIdx >= 0) {
            config.projects[existingIdx] = entry;
        }
        else {
            config.projects.push(entry);
        }
        config.activeProject = projectId;
        (0, file_1.writeJsonFile)(projectsPath, config);
        logger_1.logger.debug(`Project registered: ${projectId}`);
    }
}
exports.InitCommand = InitCommand;
//# sourceMappingURL=init.js.map