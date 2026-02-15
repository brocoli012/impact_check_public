"use strict";
/**
 * @module config/config-manager
 * @description 설정 관리자 - API 키 암호화/복호화, 설정 로드/저장
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
const crypto = __importStar(require("crypto"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const config_1 = require("../types/config");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/** 암호화 알고리즘 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
/** IV 길이 (바이트) */
const IV_LENGTH = 16;
/** Auth Tag 길이 (바이트) */
const AUTH_TAG_LENGTH = 16;
/**
 * ConfigManager 클래스 - 애플리케이션 설정 관리
 *
 * 기능:
 *   - .impact/config.json 로드/저장
 *   - API 키 AES-256-GCM 암호화/복호화
 *   - 머신별 고유 암호화 키 생성
 *   - 활성 프로젝트 관리
 */
class ConfigManager {
    /**
     * ConfigManager 인스턴스 생성
     * @param basePath - .impact 디렉토리의 기본 경로 (기본값: HOME)
     */
    constructor(basePath) {
        this.encryptionKey = null;
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
     * 프로바이더의 API 키를 조회 (복호화)
     * @param provider - 프로바이더 이름
     * @returns 복호화된 API 키 (없으면 null)
     */
    getApiKey(provider) {
        const providerConfig = this.config.llm.providers[provider];
        if (!providerConfig || !providerConfig.apiKey) {
            return null;
        }
        try {
            return this.decrypt(providerConfig.apiKey);
        }
        catch (error) {
            logger_1.logger.error(`Failed to decrypt API key for ${provider}.`);
            logger_1.logger.debug(error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }
    /**
     * 프로바이더의 API 키를 설정 (암호화)
     * @param provider - 프로바이더 이름
     * @param apiKey - 평문 API 키
     */
    setApiKey(provider, apiKey) {
        const encryptedKey = this.encrypt(apiKey);
        if (!this.config.llm.providers[provider]) {
            this.config.llm.providers[provider] = this.createDefaultProviderConfig(provider);
        }
        this.config.llm.providers[provider].apiKey = encryptedKey;
        this.config.llm.providers[provider].enabled = true;
        logger_1.logger.debug(`API key set for provider: ${provider}`);
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
     * LLM 데이터 전송 동의 여부를 설정
     * @param consent - 동의 여부
     */
    setLLMDataConsent(consent) {
        this.config.general.llmDataConsent = consent;
    }
    /**
     * 설정을 초기화 (API 키 분실 시)
     */
    reset() {
        this.config = JSON.parse(JSON.stringify(config_1.DEFAULT_CONFIG));
        logger_1.logger.info('Configuration has been reset to defaults.');
    }
    // ============================================================
    // Private Methods
    // ============================================================
    /**
     * 머신별 고유 암호화 키를 생성/조회
     * MVP에서는 머신 정보 기반으로 결정적 키 생성
     * @returns 암호화 키 Buffer
     */
    getEncryptionKey() {
        if (this.encryptionKey) {
            return this.encryptionKey;
        }
        // MVP: 머신 정보 기반 결정적 키 생성
        // Production에서는 macOS Keychain / Windows DPAPI 사용 권장
        const machineId = [
            os.hostname(),
            os.userInfo().username,
            os.platform(),
            'kurly-impact-checker-v1',
        ].join(':');
        this.encryptionKey = crypto
            .createHash('sha256')
            .update(machineId)
            .digest();
        return this.encryptionKey;
    }
    /**
     * 문자열을 AES-256-GCM으로 암호화
     * @param plaintext - 평문
     * @returns 암호화된 문자열 (iv:authTag:ciphertext, hex)
     */
    encrypt(plaintext) {
        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
    /**
     * AES-256-GCM으로 암호화된 문자열을 복호화
     * @param ciphertext - 암호화된 문자열 (iv:authTag:ciphertext, hex)
     * @returns 복호화된 평문
     */
    decrypt(ciphertext) {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format.');
        }
        const key = this.getEncryptionKey();
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * 프로바이더별 기본 설정 생성
     * @param provider - 프로바이더 이름
     * @returns 기본 LLMProviderConfig
     */
    createDefaultProviderConfig(provider) {
        const defaults = {
            anthropic: {
                name: 'anthropic',
                defaultModel: 'claude-sonnet-4-20250514',
                maxTokens: 4096,
                temperature: 0,
            },
            openai: {
                name: 'openai',
                defaultModel: 'gpt-4o',
                maxTokens: 4096,
                temperature: 0,
            },
            google: {
                name: 'google',
                defaultModel: 'gemini-2.0-flash',
                maxTokens: 4096,
                temperature: 0,
            },
        };
        const defaultConfig = defaults[provider] || {
            name: provider,
            defaultModel: '',
            maxTokens: 4096,
            temperature: 0,
        };
        return {
            name: defaultConfig.name || provider,
            apiKey: '',
            defaultModel: defaultConfig.defaultModel || '',
            maxTokens: defaultConfig.maxTokens || 4096,
            temperature: defaultConfig.temperature || 0,
            enabled: false,
        };
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config-manager.js.map