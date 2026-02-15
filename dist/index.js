"use strict";
/**
 * @module index
 * @description CLI 엔트리포인트 - process.argv를 파싱하여 명령어를 실행
 */
Object.defineProperty(exports, "__esModule", { value: true });
const router_1 = require("./router");
const common_1 = require("./types/common");
const logger_1 = require("./utils/logger");
/** 앱 버전 */
const APP_VERSION = '1.0.0';
/** 앱 이름 */
const APP_NAME = 'Kurly Impact Checker';
/**
 * CLI 메인 함수
 */
async function main() {
    // process.argv: [node, script, ...args]
    const args = process.argv.slice(2);
    // 버전 출력
    if (args.includes('--version') || args.includes('-v')) {
        console.log(`${APP_NAME} v${APP_VERSION}`);
        process.exit(0);
    }
    try {
        const command = (0, router_1.route)(args);
        const result = await command.execute();
        if (result.code === common_1.ResultCode.SUCCESS) {
            logger_1.logger.debug(`Command '${command.name}' completed successfully.`);
        }
        else if (result.code === common_1.ResultCode.FAILURE) {
            logger_1.logger.error(`Command '${command.name}' failed: ${result.message}`);
            process.exit(1);
        }
        else if (result.code === common_1.ResultCode.NEEDS_CONFIG) {
            logger_1.logger.warn(result.message);
            logger_1.logger.info('Run "/impact config" to set up your configuration.');
            process.exit(1);
        }
        else if (result.code === common_1.ResultCode.NEEDS_INDEX) {
            logger_1.logger.warn(result.message);
            logger_1.logger.info('Run "/impact init <project_path>" to create an index.');
            process.exit(1);
        }
    }
    catch (error) {
        if (error instanceof router_1.UnknownCommandError) {
            logger_1.logger.error(error.message);
            logger_1.logger.info('Run "/impact help" for a list of available commands.');
            process.exit(1);
        }
        if (error instanceof Error) {
            logger_1.logger.error(`Unexpected error: ${error.message}`);
            logger_1.logger.debug(error.stack || '');
        }
        else {
            logger_1.logger.error('An unexpected error occurred.');
        }
        process.exit(1);
    }
}
// 실행
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map