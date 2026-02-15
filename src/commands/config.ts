/**
 * @module commands/config
 * @description Config 명령어 핸들러 - LLM 프로바이더 및 API 키 설정
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfigManager } from '../config/config-manager';
import { logger } from '../utils/logger';

/**
 * ConfigCommand - 설정 관리 명령어
 *
 * 사용법: /impact config [--provider <name>] [--key <api_key>]
 * 기능:
 *   - LLM 프로바이더 설정
 *   - API 키 등록 (암호화 저장)
 *   - 현재 설정 조회
 */
export class ConfigCommand implements Command {
  readonly name = 'config';
  readonly description = 'LLM 프로바이더 및 API 키를 설정합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    const providerIndex = this.args.indexOf('--provider');
    const keyIndex = this.args.indexOf('--key');

    const provider = providerIndex !== -1 ? this.args[providerIndex + 1] : undefined;
    const key = keyIndex !== -1 ? this.args[keyIndex + 1] : undefined;

    if (provider && key) {
      try {
        const configManager = new ConfigManager();
        await configManager.load();
        configManager.setApiKey(provider, key);
        await configManager.save();
        logger.success(`API 키가 설정되었습니다: ${provider}`);
        return {
          code: ResultCode.SUCCESS,
          message: `API key set for provider: ${provider}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`설정 저장 실패: ${message}`);
        return {
          code: ResultCode.FAILURE,
          message: `Failed to save config: ${message}`,
        };
      }
    }

    if (provider && !key) {
      logger.error('API 키를 함께 지정해 주세요.');
      console.log('\n사용법: /impact config --provider <name> --key <api_key>');
      return {
        code: ResultCode.FAILURE,
        message: 'API key is required when setting provider.',
      };
    }

    // 인자 없이 실행 시 현재 설정 표시
    try {
      const configManager = new ConfigManager();
      await configManager.load();
      const config = configManager.getConfig();

      logger.header('Kurly Impact Checker - Configuration');
      console.log(`\n  Default Provider: ${config.llm.defaultProvider}`);
      console.log(`  Configured Providers: ${Object.keys(config.llm.providers).join(', ') || '(none)'}`);
      console.log(`  Web Port: ${config.general.webPort}`);
      console.log(`  Auto Reindex: ${config.general.autoReindex}`);
      console.log(`  Log Level: ${config.general.logLevel}`);
      console.log('');
    } catch {
      logger.info('설정 파일이 없습니다. 아래 명령으로 설정을 시작하세요.');
      console.log('\n사용법: /impact config --provider <name> --key <api_key>');
      console.log('예시:   /impact config --provider anthropic --key sk-ant-xxxxx');
    }

    return {
      code: ResultCode.SUCCESS,
      message: 'Config command executed.',
    };
  }
}
