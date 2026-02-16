"use strict";
/**
 * @module commands/save-result
 * @description Save Result 명령어 핸들러 - 분석 결과 JSON 파일을 저장소에 등록
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
exports.SaveResultCommand = void 0;
const fs = __importStar(require("fs"));
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const result_manager_1 = require("../core/analysis/result-manager");
const validators_1 = require("../utils/validators");
const logger_1 = require("../utils/logger");
/**
 * SaveResultCommand - 분석 결과 저장 명령어
 *
 * 사용법: /impact save-result --file <path> [--project <id>]
 * 기능:
 *   - JSON 파일을 읽어 검증 후 ResultManager를 통해 저장
 *   - analysisMethod가 없으면 'claude-native' 기본 설정
 *   - --project <id>: 특정 프로젝트 지정
 */
class SaveResultCommand {
    constructor(args) {
        this.name = 'save-result';
        this.description = '분석 결과 JSON 파일을 프로젝트 저장소에 등록합니다.';
        this.args = args;
    }
    async execute() {
        try {
            // --file 옵션 파싱
            const filePath = this.getOption('--file');
            if (!filePath) {
                logger_1.logger.error('--file 옵션이 필요합니다.');
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: '--file option is required. Usage: save-result --file <path>',
                };
            }
            // 파일 존재 확인
            if (!fs.existsSync(filePath)) {
                logger_1.logger.error(`파일을 찾을 수 없습니다: ${filePath}`);
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: `File not found: ${filePath}`,
                };
            }
            // 파일 읽기 및 JSON 파싱
            let rawData;
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                rawData = JSON.parse(content);
            }
            catch (parseErr) {
                const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
                logger_1.logger.error(`JSON 파싱 실패: ${msg}`);
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: `Failed to parse JSON: ${msg}`,
                };
            }
            // 런타임 검증
            const validation = (0, validators_1.validateImpactResult)(rawData);
            if (!validation.valid) {
                const errorMessages = validation.errors.map(e => `  - ${e.field}: ${e.message}`).join('\n');
                logger_1.logger.error(`검증 실패:\n${errorMessages}`);
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: `Validation failed:\n${errorMessages}`,
                };
            }
            // analysisMethod 기본값 설정
            const result = rawData;
            if (!result.analysisMethod) {
                result['analysisMethod'] = 'claude-native';
            }
            // 프로젝트 ID 결정
            const projectId = this.getOption('--project');
            const resolvedProjectId = await this.resolveProjectId(projectId);
            if (!resolvedProjectId) {
                logger_1.logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: 'No active project. Run /impact init first.',
                };
            }
            // ResultManager로 저장
            const resultManager = new result_manager_1.ResultManager();
            const savedId = await resultManager.save(result, resolvedProjectId);
            logger_1.logger.success(`분석 결과가 저장되었습니다: ${savedId}`);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Result saved: ${savedId}`,
                data: { resultId: savedId, projectId: resolvedProjectId },
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`결과 저장 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Save failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 프로젝트 ID를 확정
     */
    async resolveProjectId(explicitId) {
        if (explicitId) {
            return explicitId;
        }
        const configManager = new config_manager_1.ConfigManager();
        await configManager.load();
        return configManager.getActiveProject();
    }
    /**
     * 인자에서 옵션 값을 추출
     */
    getOption(flag) {
        const idx = this.args.indexOf(flag);
        if (idx >= 0 && idx + 1 < this.args.length) {
            return this.args[idx + 1];
        }
        return undefined;
    }
}
exports.SaveResultCommand = SaveResultCommand;
//# sourceMappingURL=save-result.js.map