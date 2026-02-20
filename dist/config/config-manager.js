"use strict";
/**
 * @module config/config-manager
 * @description 설정 관리자 - 설정 로드/저장, 활성 프로젝트 관리
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
exports.ConfigManager = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const config_1 = require("../types/config");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * ConfigManager 클래스 - 애플리케이션 설정 관리
 *
 * 기능:
 *   - .impact/config.json 로드/저장
 *   - 활성 프로젝트 관리
 */
class ConfigManager {
    /**
     * ConfigManager 인스턴스 생성
     * @param basePath - .impact 디렉토리의 기본 경로 (기본값: HOME)
     */
    constructor(basePath) {
        const base = basePath || os.homedir();
        this.configDir = path.join(base, '.impact');
        this.configPath = path.join(this.configDir, 'config.json');
        this.config = JSON.parse(JSON.stringify(config_1.DEFAULT_CONFIG));
    }
    /**
     * 설정 파일을 로드
     * 파일이 없으면 기본 설정 사용
     */
    async load() {
        (0, file_1.ensureDir)(this.configDir);
        if ((0, file_1.fileExists)(this.configPath)) {
            const loaded = (0, file_1.readJsonFile)(this.configPath);
            if (loaded) {
                const defaults = JSON.parse(JSON.stringify(config_1.DEFAULT_CONFIG));
                this.config = { ...defaults, ...loaded };
                logger_1.logger.debug('Configuration loaded successfully.');
            }
            else {
                logger_1.logger.warn('Failed to parse config file. Using defaults.');
                this.config = JSON.parse(JSON.stringify(config_1.DEFAULT_CONFIG));
            }
        }
        else {
            logger_1.logger.debug('No config file found. Using defaults.');
            this.config = JSON.parse(JSON.stringify(config_1.DEFAULT_CONFIG));
        }
    }
    /**
     * 현재 설정을 파일로 저장
     */
    async save() {
        (0, file_1.ensureDir)(this.configDir);
        (0, file_1.writeJsonFile)(this.configPath, this.config);
        logger_1.logger.debug('Configuration saved successfully.');
    }
    /**
     * 현재 설정을 반환
     * @returns 현재 AppConfig
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 활성 프로젝트 ID를 조회
     * @returns 활성 프로젝트 ID (없으면 null)
     */
    getActiveProject() {
        const projectsPath = path.join(this.configDir, 'projects.json');
        const projects = (0, file_1.readJsonFile)(projectsPath);
        return projects?.activeProject || null;
    }
    /**
     * 활성 프로젝트 ID를 설정
     * @param projectId - 프로젝트 ID
     */
    setActiveProject(projectId) {
        const projectsPath = path.join(this.configDir, 'projects.json');
        const projects = (0, file_1.readJsonFile)(projectsPath) || {
            activeProject: '',
            projects: [],
        };
        projects.activeProject = projectId;
        (0, file_1.writeJsonFile)(projectsPath, projects);
        logger_1.logger.debug(`Active project set to: ${projectId}`);
    }
    /**
     * 설정을 초기화
     */
    reset() {
        this.config = JSON.parse(JSON.stringify(config_1.DEFAULT_CONFIG));
        logger_1.logger.info('Configuration has been reset to defaults.');
    }
    /**
     * 정책 문서 저장 디렉토리 경로를 반환한다.
     * ~/.impact/docs/{projectId}
     */
    static getDocsDir(projectId) {
        return path.join((0, file_1.getImpactDir)(), 'docs', projectId);
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config-manager.js.map