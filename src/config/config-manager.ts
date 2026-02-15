/**
 * @module config/config-manager
 * @description 설정 관리자 - API 키 암호화/복호화, 설정 로드/저장
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { AppConfig, LLMProviderConfig, DEFAULT_CONFIG } from '../types/config';
import { ensureDir, readJsonFile, writeJsonFile, fileExists } from '../utils/file';
import { logger } from '../utils/logger';

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
export class ConfigManager {
  private config: AppConfig;
  private readonly configDir: string;
  private readonly configPath: string;
  private encryptionKey: Buffer | null = null;

  /**
   * ConfigManager 인스턴스 생성
   * @param basePath - .impact 디렉토리의 기본 경로 (기본값: HOME)
   */
  constructor(basePath?: string) {
    const base = basePath || os.homedir();
    this.configDir = path.join(base, '.impact');
    this.configPath = path.join(this.configDir, 'config.json');
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
  }

  /**
   * 설정 파일을 로드
   * 파일이 없으면 기본 설정 사용
   */
  async load(): Promise<void> {
    ensureDir(this.configDir);

    if (fileExists(this.configPath)) {
      const loaded = readJsonFile<AppConfig>(this.configPath);
      if (loaded) {
        const defaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
        this.config = { ...defaults, ...loaded };
        logger.debug('Configuration loaded successfully.');
      } else {
        logger.warn('Failed to parse config file. Using defaults.');
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
      }
    } else {
      logger.debug('No config file found. Using defaults.');
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
    }
  }

  /**
   * 현재 설정을 파일로 저장
   */
  async save(): Promise<void> {
    ensureDir(this.configDir);
    writeJsonFile(this.configPath, this.config);
    logger.debug('Configuration saved successfully.');
  }

  /**
   * 현재 설정을 반환
   * @returns 현재 AppConfig
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * 프로바이더의 API 키를 조회 (복호화)
   * @param provider - 프로바이더 이름
   * @returns 복호화된 API 키 (없으면 null)
   */
  getApiKey(provider: string): string | null {
    const providerConfig = this.config.llm.providers[provider];
    if (!providerConfig || !providerConfig.apiKey) {
      return null;
    }

    try {
      return this.decrypt(providerConfig.apiKey);
    } catch (error) {
      logger.error(`Failed to decrypt API key for ${provider}.`);
      logger.debug(error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * 프로바이더의 API 키를 설정 (암호화)
   * @param provider - 프로바이더 이름
   * @param apiKey - 평문 API 키
   */
  setApiKey(provider: string, apiKey: string): void {
    const encryptedKey = this.encrypt(apiKey);

    if (!this.config.llm.providers[provider]) {
      this.config.llm.providers[provider] = this.createDefaultProviderConfig(provider);
    }

    this.config.llm.providers[provider].apiKey = encryptedKey;
    this.config.llm.providers[provider].enabled = true;
    logger.debug(`API key set for provider: ${provider}`);
  }

  /**
   * 활성 프로젝트 ID를 조회
   * @returns 활성 프로젝트 ID (없으면 null)
   */
  getActiveProject(): string | null {
    const projectsPath = path.join(this.configDir, 'projects.json');
    const projects = readJsonFile<{ activeProject: string }>(projectsPath);
    return projects?.activeProject || null;
  }

  /**
   * 활성 프로젝트 ID를 설정
   * @param projectId - 프로젝트 ID
   */
  setActiveProject(projectId: string): void {
    const projectsPath = path.join(this.configDir, 'projects.json');
    const projects = readJsonFile<{ activeProject: string; projects: unknown[] }>(projectsPath) || {
      activeProject: '',
      projects: [],
    };
    projects.activeProject = projectId;
    writeJsonFile(projectsPath, projects);
    logger.debug(`Active project set to: ${projectId}`);
  }

  /**
   * LLM 데이터 전송 동의 여부를 설정
   * @param consent - 동의 여부
   */
  setLLMDataConsent(consent: boolean): void {
    this.config.general.llmDataConsent = consent;
  }

  /**
   * 설정을 초기화 (API 키 분실 시)
   */
  reset(): void {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
    logger.info('Configuration has been reset to defaults.');
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 머신별 고유 암호화 키를 생성/조회
   * MVP에서는 머신 정보 기반으로 결정적 키 생성
   * @returns 암호화 키 Buffer
   */
  private getEncryptionKey(): Buffer {
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
  private encrypt(plaintext: string): string {
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
  private decrypt(ciphertext: string): string {
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
  private createDefaultProviderConfig(provider: string): LLMProviderConfig {
    const defaults: Record<string, Partial<LLMProviderConfig>> = {
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
