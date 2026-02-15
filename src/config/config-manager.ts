/**
 * @module config/config-manager
 * @description 설정 관리자 - 설정 로드/저장, 활성 프로젝트 관리
 */

import * as os from 'os';
import * as path from 'path';
import { AppConfig, DEFAULT_CONFIG } from '../types/config';
import { ensureDir, readJsonFile, writeJsonFile, fileExists } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * ConfigManager 클래스 - 애플리케이션 설정 관리
 *
 * 기능:
 *   - .impact/config.json 로드/저장
 *   - 활성 프로젝트 관리
 */
export class ConfigManager {
  private config: AppConfig;
  private readonly configDir: string;
  private readonly configPath: string;

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
   * 설정을 초기화
   */
  reset(): void {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
    logger.info('Configuration has been reset to defaults.');
  }
}
