/**
 * @module index
 * @description CLI 엔트리포인트 - process.argv를 파싱하여 명령어를 실행
 */

import { route, UnknownCommandError } from './router';
import { ResultCode } from './types/common';
import { logger } from './utils/logger';

/** 앱 버전 */
const APP_VERSION = '1.0.0';

/** 앱 이름 */
const APP_NAME = 'Kurly Impact Checker';

/**
 * CLI 메인 함수
 */
async function main(): Promise<void> {
  // process.argv: [node, script, ...args]
  const args = process.argv.slice(2);

  // 버전 출력
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`${APP_NAME} v${APP_VERSION}`);
    process.exit(0);
  }

  try {
    const command = route(args);
    const result = await command.execute();

    if (result.code === ResultCode.SUCCESS) {
      logger.debug(`Command '${command.name}' completed successfully.`);
    } else if (result.code === ResultCode.FAILURE) {
      logger.error(`Command '${command.name}' failed: ${result.message}`);
      process.exit(1);
    } else if (result.code === ResultCode.NEEDS_CONFIG) {
      logger.warn(result.message);
      logger.info('Run "/impact config" to set up your configuration.');
      process.exit(1);
    } else if (result.code === ResultCode.NEEDS_INDEX) {
      logger.warn(result.message);
      logger.info('Run "/impact init <project_path>" to create an index.');
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof UnknownCommandError) {
      logger.error(error.message);
      logger.info('Run "/impact help" for a list of available commands.');
      process.exit(1);
    }

    if (error instanceof Error) {
      logger.error(`Unexpected error: ${error.message}`);
      logger.debug(error.stack || '');
    } else {
      logger.error('An unexpected error occurred.');
    }
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
