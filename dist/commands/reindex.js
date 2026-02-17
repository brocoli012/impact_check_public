"use strict";
/**
 * @module commands/reindex
 * @description Reindex 명령어 핸들러 - 코드 인덱스를 수동으로 갱신
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
exports.ReindexCommand = void 0;
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const indexer_1 = require("../core/indexing/indexer");
const config_manager_1 = require("../config/config-manager");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * ReindexCommand - 인덱스 갱신 명령어
 *
 * 사용법: /impact reindex [--full] [--incremental]
 * 기능:
 *   - 증분 인덱스 업데이트 (기본)
 *   - --full 옵션으로 전체 재인덱싱
 *   - --incremental 옵션으로 명시적 증분 인덱싱
 *   - isIndexStale 확인 후 자동 분기
 *   - 변경 비율 30% 초과 시 전체 인덱싱 전환
 *   - 증분 인덱싱 실패 시 전체 인덱싱 폴백
 *   - 인덱싱 진행률 출력
 */
class ReindexCommand {
    constructor(args) {
        this.name = 'reindex';
        this.description = '코드 인덱스를 수동으로 갱신합니다.';
        this.args = args;
    }
    async execute() {
        const isFull = this.args.includes('--full');
        const isIncremental = this.args.includes('--incremental');
        try {
            // 활성 프로젝트 확인
            const configManager = new config_manager_1.ConfigManager();
            await configManager.load();
            const activeProjectId = configManager.getActiveProject();
            if (!activeProjectId) {
                logger_1.logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: 'No active project. Run /impact init first.',
                };
            }
            // 프로젝트 정보 로드
            const impactDir = (0, file_1.getImpactDir)();
            const projectsPath = path.join(impactDir, 'projects.json');
            const projectsConfig = (0, file_1.readJsonFile)(projectsPath);
            if (!projectsConfig) {
                logger_1.logger.error('프로젝트 설정을 찾을 수 없습니다.');
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: 'Projects config not found.',
                };
            }
            const project = projectsConfig.projects.find(p => p.id === activeProjectId);
            if (!project) {
                logger_1.logger.error(`프로젝트를 찾을 수 없습니다: ${activeProjectId}`);
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: `Project not found: ${activeProjectId}`,
                };
            }
            logger_1.logger.header('Impact Checker - 인덱스 갱신');
            console.log(`\n프로젝트: ${project.name}`);
            console.log(`경로: ${project.path}`);
            const indexer = new indexer_1.Indexer();
            let codeIndex;
            const startTime = Date.now();
            if (isFull) {
                // --full: 무조건 전체 인덱싱
                console.log(`모드: 전체 재인덱싱\n`);
                logger_1.logger.info('전체 재인덱싱을 시작합니다...');
                codeIndex = await indexer.fullIndex(project.path);
            }
            else {
                // 기본 동작 또는 --incremental: isIndexStale 확인 후 분기
                console.log(`모드: ${isIncremental ? '증분 업데이트 (명시적)' : '자동 감지'}\n`);
                logger_1.logger.info('인덱스 상태 확인 중...');
                const stale = await indexer.isIndexStale(project.path, activeProjectId);
                if (!stale && !isIncremental) {
                    logger_1.logger.success('이미 최신 상태입니다.');
                    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`\n소요 시간: ${elapsedSec}s`);
                    return {
                        code: common_1.ResultCode.SUCCESS,
                        message: 'Index is already up to date.',
                        data: {
                            projectId: activeProjectId,
                            mode: 'none',
                            upToDate: true,
                        },
                    };
                }
                // stale이거나 --incremental인 경우 증분 인덱싱 시도
                logger_1.logger.info('변경된 파일 감지 중...');
                try {
                    codeIndex = await indexer.incrementalUpdate(project.path, activeProjectId);
                }
                catch (err) {
                    // 증분 인덱싱 실패 시 전체 인덱싱 폴백
                    const errMsg = err instanceof Error ? err.message : String(err);
                    logger_1.logger.warn(`증분 인덱싱 실패, 전체 인덱싱으로 전환합니다: ${errMsg}`);
                    codeIndex = await indexer.fullIndex(project.path);
                }
            }
            // 인덱스 저장
            await indexer.saveIndex(codeIndex, activeProjectId);
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            // 결과 출력
            logger_1.logger.separator();
            console.log('\n인덱싱 결과 요약:');
            console.log(`  파일 수:       ${codeIndex.meta.stats.totalFiles}`);
            console.log(`  화면 수:       ${codeIndex.meta.stats.screens}`);
            console.log(`  컴포넌트 수:   ${codeIndex.meta.stats.components}`);
            console.log(`  API 엔드포인트: ${codeIndex.meta.stats.apiEndpoints}`);
            console.log(`  모듈 수:       ${codeIndex.meta.stats.modules}`);
            console.log(`  정책 수:       ${codeIndex.policies.length}`);
            logger_1.logger.separator();
            const mode = isFull ? 'full' : (codeIndex.meta.lastUpdateType || 'incremental');
            console.log(`인덱싱 완료: ${codeIndex.meta.stats.totalFiles}개 파일 처리 (소요 시간: ${elapsedSec}s)`);
            logger_1.logger.success('인덱스 갱신이 완료되었습니다!');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Reindex complete for ${activeProjectId}`,
                data: {
                    projectId: activeProjectId,
                    mode,
                    stats: codeIndex.meta.stats,
                    elapsedSeconds: parseFloat(elapsedSec),
                },
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`인덱스 갱신 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Reindex failed: ${errorMsg}`,
            };
        }
    }
}
exports.ReindexCommand = ReindexCommand;
//# sourceMappingURL=reindex.js.map