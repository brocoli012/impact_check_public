"use strict";
/**
 * @module commands/config
 * @description Config 명령어 핸들러 - 설정 조회/관리
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigCommand = void 0;
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const logger_1 = require("../utils/logger");
/**
 * ConfigCommand - 설정 관리 명령어
 *
 * 사용법: /impact config
 * 기능:
 *   - 현재 설정 조회
 */
class ConfigCommand {
    constructor(_args) {
        this.name = 'config';
        this.description = '설정을 조회합니다.';
        // args reserved for future use
    }
    async execute() {
        // 현재 설정 표시
        try {
            const configManager = new config_manager_1.ConfigManager();
            await configManager.load();
            const config = configManager.getConfig();
            logger_1.logger.header('Kurly Impact Checker - Configuration');
            console.log(`\n  Web Port: ${config.general.webPort}`);
            console.log(`  Auto Reindex: ${config.general.autoReindex}`);
            console.log(`  Log Level: ${config.general.logLevel}`);
            console.log('');
        }
        catch {
            logger_1.logger.info('설정 파일이 없습니다.');
        }
        return {
            code: common_1.ResultCode.SUCCESS,
            message: 'Config command executed.',
        };
    }
}
exports.ConfigCommand = ConfigCommand;
//# sourceMappingURL=config.js.map