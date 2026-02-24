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
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const result_manager_1 = require("../core/analysis/result-manager");
const cross_project_manager_1 = require("../core/cross-project/cross-project-manager");
const indexer_1 = require("../core/indexing/indexer");
const validators_1 = require("../utils/validators");
const file_1 = require("../utils/file");
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
            // === 후처리 hook: 크로스 프로젝트 자동 감지 ===
            const skipCrossDetect = this.args.includes('--skip-cross-detect');
            if (!skipCrossDetect) {
                try {
                    const detectResult = await this.runCrossProjectHook(resolvedProjectId);
                    // TASK-056: 탐지 결과를 분석 결과 요약에 기록
                    if (detectResult) {
                        await resultManager.updateCrossProjectDetection(resolvedProjectId, savedId, {
                            detectedAt: new Date().toISOString(),
                            linksDetected: detectResult.detected,
                            linksNew: detectResult.saved,
                            linksTotal: detectResult.total,
                        });
                    }
                }
                catch (hookErr) {
                    const hookMsg = hookErr instanceof Error ? hookErr.message : String(hookErr);
                    logger_1.logger.warn(`크로스 프로젝트 갱신 실패 (분석 결과는 저장됨): ${hookMsg}`);
                }
            }
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
     * 크로스 프로젝트 자동 감지 후처리 hook
     * - 등록 프로젝트가 2개 이상일 때만 실행
     * - 실패해도 save-result 전체에 영향 없음 (호출자에서 catch)
     * @returns DetectResult 또는 null (프로젝트 부족 시)
     */
    async runCrossProjectHook(_projectId) {
        // projects.json에서 프로젝트 목록 로드
        const projectsPath = path.join((0, file_1.getImpactDir)(), 'projects.json');
        const projectsConfig = (0, file_1.readJsonFile)(projectsPath);
        const projectIds = projectsConfig?.projects?.map(p => p.id) || [];
        if (projectIds.length < 2) {
            logger_1.logger.debug('등록 프로젝트 1개 이하: 크로스 프로젝트 감지 건너뜀');
            return null;
        }
        logger_1.logger.info(`등록 프로젝트 ${projectIds.length}개 감지, detectAndSave 실행...`);
        const indexer = new indexer_1.Indexer();
        const manager = new cross_project_manager_1.CrossProjectManager();
        const result = await manager.detectAndSave(indexer, projectIds);
        if (result.saved > 0) {
            const typeStats = Object.entries(result.byType)
                .map(([type, count]) => `${type} ${count}건`)
                .join(', ');
            logger_1.logger.success(`크로스 프로젝트 자동 탐지: ${result.detected}건 발견, ${result.saved}건 신규 저장 (${typeStats})`);
        }
        else if (result.detected > 0) {
            logger_1.logger.info(`크로스 프로젝트 자동 탐지: ${result.detected}건 발견 (신규 없음)`);
        }
        else {
            logger_1.logger.info('신규 크로스 프로젝트 의존성 없음');
        }
        return result;
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