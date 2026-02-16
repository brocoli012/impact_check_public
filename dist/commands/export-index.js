"use strict";
/**
 * @module commands/export-index
 * @description Export Index 명령어 핸들러 - 코드 인덱스를 요약/전체 형태로 내보내기
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
exports.ExportIndexCommand = void 0;
const fs = __importStar(require("fs"));
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const indexer_1 = require("../core/indexing/indexer");
const index_summarizer_1 = require("../utils/index-summarizer");
const logger_1 = require("../utils/logger");
/**
 * ExportIndexCommand - 인덱스 내보내기 명령어
 *
 * 사용법: /impact export-index [--project <id>] [--summary|--full] [--output <file>]
 * 기능:
 *   - --summary (기본): 요약 형태로 출력
 *   - --full: 전체 인덱스 출력
 *   - --output <file>: 파일로 저장
 *   - --project <id>: 특정 프로젝트 지정
 */
class ExportIndexCommand {
    constructor(args) {
        this.name = 'export-index';
        this.description = '코드 인덱스를 요약 또는 전체 형태로 내보냅니다.';
        this.args = args;
    }
    async execute() {
        try {
            // 옵션 파싱
            const projectId = this.getOption('--project');
            const isFull = this.args.includes('--full');
            const outputPath = this.getOption('--output');
            // 프로젝트 ID 결정
            const resolvedProjectId = await this.resolveProjectId(projectId);
            if (!resolvedProjectId) {
                logger_1.logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: 'No active project. Run /impact init first.',
                };
            }
            // 인덱스 로드
            const indexer = new indexer_1.Indexer();
            const codeIndex = await indexer.loadIndex(resolvedProjectId);
            if (!codeIndex) {
                logger_1.logger.error('인덱스를 찾을 수 없습니다. /impact reindex를 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: `Index not found for project '${resolvedProjectId}'. Run /impact reindex first.`,
                };
            }
            // 요약 또는 전체
            const output = isFull ? codeIndex : (0, index_summarizer_1.summarizeIndex)(codeIndex);
            const jsonStr = JSON.stringify(output, null, 2);
            // 출력
            if (outputPath) {
                fs.writeFileSync(outputPath, jsonStr, 'utf-8');
                logger_1.logger.success(`인덱스를 파일로 저장했습니다: ${outputPath}`);
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: `Index exported to ${outputPath}`,
                    data: { projectId: resolvedProjectId, outputPath, mode: isFull ? 'full' : 'summary' },
                };
            }
            else {
                console.log(jsonStr);
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: `Index exported (${isFull ? 'full' : 'summary'}) for project '${resolvedProjectId}'`,
                    data: { projectId: resolvedProjectId, mode: isFull ? 'full' : 'summary' },
                };
            }
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`인덱스 내보내기 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Export failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 프로젝트 ID를 확정 (명시적 지정 또는 활성 프로젝트)
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
exports.ExportIndexCommand = ExportIndexCommand;
//# sourceMappingURL=export-index.js.map