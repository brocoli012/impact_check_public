/**
 * @module commands/config
 * @description Config 명령어 핸들러 - 설정 조회/관리
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfigManager } from '../config/config-manager';
import { logger } from '../utils/logger';

/**
 * ConfigCommand - 설정 관리 명령어
 *
 * 사용법: /impact config
 * 기능:
 *   - 현재 설정 조회
 */
export class ConfigCommand implements Command {
  readonly name = 'config';
  readonly description = '설정을 조회합니다.';
  constructor(_args: string[]) {
    // args reserved for future use
  }

  async execute(): Promise<CommandResult> {
    // 현재 설정 표시
    try {
      const configManager = new ConfigManager();
      await configManager.load();
      const config = configManager.getConfig();

      logger.header('Kurly Impact Checker - Configuration');
      console.log(`\n  Web Port: ${config.general.webPort}`);
      console.log(`  Auto Reindex: ${config.general.autoReindex}`);
      console.log(`  Log Level: ${config.general.logLevel}`);
      console.log(`  Auto Update: ${config.general.autoUpdate}`);
      console.log(`  Update Check Interval: ${config.general.updateCheckInterval}s`);
      console.log('');
    } catch {
      logger.info('설정 파일이 없습니다.');
    }

    return {
      code: ResultCode.SUCCESS,
      message: 'Config command executed.',
    };
  }
}
