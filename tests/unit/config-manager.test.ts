/**
 * @module tests/unit/config-manager
 * @description ConfigManager 단위 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/config/config-manager';
import { DEFAULT_CONFIG } from '../../src/types/config';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    // 테스트용 임시 디렉토리 생성
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-test-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    // 임시 디렉토리 정리
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('load()', () => {
    it('should create .impact directory if it does not exist', async () => {
      await configManager.load();
      const impactDir = path.join(tempDir, '.impact');
      expect(fs.existsSync(impactDir)).toBe(true);
    });

    it('should use default config when no config file exists', async () => {
      await configManager.load();
      const config = configManager.getConfig();
      expect(config.version).toBe(DEFAULT_CONFIG.version);
      expect(config.llm.defaultProvider).toBe(DEFAULT_CONFIG.llm.defaultProvider);
      expect(config.general.webPort).toBe(DEFAULT_CONFIG.general.webPort);
    });

    it('should load existing config file', async () => {
      // 먼저 설정 파일 생성
      const impactDir = path.join(tempDir, '.impact');
      fs.mkdirSync(impactDir, { recursive: true });
      const configPath = path.join(impactDir, 'config.json');
      const customConfig = {
        ...DEFAULT_CONFIG,
        general: { ...DEFAULT_CONFIG.general, webPort: 9999 },
      };
      fs.writeFileSync(configPath, JSON.stringify(customConfig));

      await configManager.load();
      const config = configManager.getConfig();
      expect(config.general.webPort).toBe(9999);
    });
  });

  describe('save()', () => {
    it('should save config to file', async () => {
      await configManager.load();
      await configManager.save();

      const configPath = path.join(tempDir, '.impact', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(saved.version).toBe(DEFAULT_CONFIG.version);
    });
  });

  describe('getConfig()', () => {
    it('should return a copy of the config (not a reference)', async () => {
      await configManager.load();
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('API Key encryption/decryption', () => {
    it('should encrypt and decrypt API key correctly', async () => {
      await configManager.load();
      const testKey = 'sk-ant-test-key-12345';

      configManager.setApiKey('anthropic', testKey);
      const retrievedKey = configManager.getApiKey('anthropic');

      expect(retrievedKey).toBe(testKey);
    });

    it('should store encrypted API key (not plaintext)', async () => {
      await configManager.load();
      const testKey = 'sk-ant-test-key-12345';

      configManager.setApiKey('anthropic', testKey);
      await configManager.save();

      // 파일에서 직접 읽어서 평문이 아님을 확인
      const configPath = path.join(tempDir, '.impact', 'config.json');
      const raw = fs.readFileSync(configPath, 'utf-8');
      expect(raw).not.toContain(testKey);
    });

    it('should return null for non-existent provider', async () => {
      await configManager.load();
      const key = configManager.getApiKey('nonexistent');
      expect(key).toBeNull();
    });

    it('should handle multiple providers', async () => {
      await configManager.load();

      configManager.setApiKey('anthropic', 'sk-ant-key1');
      configManager.setApiKey('openai', 'sk-openai-key2');
      configManager.setApiKey('google', 'AIza-google-key3');

      expect(configManager.getApiKey('anthropic')).toBe('sk-ant-key1');
      expect(configManager.getApiKey('openai')).toBe('sk-openai-key2');
      expect(configManager.getApiKey('google')).toBe('AIza-google-key3');
    });

    it('should enable provider after setting API key', async () => {
      await configManager.load();
      configManager.setApiKey('anthropic', 'sk-ant-test');
      const config = configManager.getConfig();
      expect(config.llm.providers['anthropic'].enabled).toBe(true);
    });

    it('should persist API keys across save/load cycle', async () => {
      await configManager.load();
      configManager.setApiKey('anthropic', 'sk-ant-persist-test');
      await configManager.save();

      // 새 ConfigManager 인스턴스로 로드
      const newConfigManager = new ConfigManager(tempDir);
      await newConfigManager.load();
      const key = newConfigManager.getApiKey('anthropic');
      expect(key).toBe('sk-ant-persist-test');
    });
  });

  describe('Active project management', () => {
    it('should return null when no active project is set', async () => {
      await configManager.load();
      const activeProject = configManager.getActiveProject();
      expect(activeProject).toBeNull();
    });

    it('should set and get active project', async () => {
      await configManager.load();
      configManager.setActiveProject('my-project');
      const activeProject = configManager.getActiveProject();
      expect(activeProject).toBe('my-project');
    });

    it('should change active project', async () => {
      await configManager.load();
      configManager.setActiveProject('project-1');
      configManager.setActiveProject('project-2');
      const activeProject = configManager.getActiveProject();
      expect(activeProject).toBe('project-2');
    });
  });

  describe('reset()', () => {
    it('should reset config to defaults', async () => {
      await configManager.load();
      configManager.setApiKey('anthropic', 'sk-ant-test');

      configManager.reset();
      const config = configManager.getConfig();
      expect(Object.keys(config.llm.providers)).toHaveLength(0);
      expect(config.general.webPort).toBe(DEFAULT_CONFIG.general.webPort);
    });
  });

  describe('setLLMDataConsent()', () => {
    it('should set LLM data consent', async () => {
      await configManager.load();
      configManager.setLLMDataConsent(true);
      const config = configManager.getConfig();
      expect(config.general.llmDataConsent).toBe(true);
    });
  });
});
