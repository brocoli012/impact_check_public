"use strict";
/**
 * @module commands/update
 * @description Update 명령어 핸들러 - KIC 도구를 최신 버전으로 업데이트
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
exports.UpdateCommand = void 0;
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const common_1 = require("../types/common");
const logger_1 = require("../utils/logger");
/**
 * UpdateCommand - KIC 업데이트 명령어
 *
 * 사용법: /impact update [--check] [--force]
 * 기능:
 *   - 최신 버전 확인 (기본)
 *   - --check: 업데이트 확인만 수행
 *   - --force: 즉시 업데이트 수행
 */
class UpdateCommand {
    constructor(args) {
        this.name = 'update';
        this.description = 'KIC 도구를 최신 버전으로 업데이트합니다.';
        this.args = args;
        this.skillDir = path.resolve(__dirname, '..', '..');
    }
    async execute() {
        const isCheckOnly = this.args.includes('--check');
        const isForce = this.args.includes('--force');
        try {
            logger_1.logger.header('Impact Checker - 업데이트');
            // 업데이트 확인
            const checkResult = await this.checkForUpdate();
            if (checkResult.skipped) {
                const message = `업데이트 확인을 건너뜁니다: ${checkResult.reason}`;
                logger_1.logger.warn(message);
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message,
                    data: { skipped: true, reason: checkResult.reason },
                };
            }
            if (!checkResult.available) {
                const message = `KIC가 최신 상태입니다. (${checkResult.localCommit?.substring(0, 7)})`;
                logger_1.logger.success(message);
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message,
                    data: { upToDate: true, commit: checkResult.localCommit },
                };
            }
            // 업데이트 가능 상태
            const statusMessage = `KIC 업데이트 가능: ${checkResult.behind}개 커밋 뒤처짐\n` +
                `현재: ${checkResult.localCommit?.substring(0, 7)}\n` +
                `최신: ${checkResult.remoteCommit?.substring(0, 7)}`;
            if (isCheckOnly) {
                logger_1.logger.info(statusMessage);
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: statusMessage,
                    data: {
                        available: true,
                        behind: checkResult.behind,
                        localCommit: checkResult.localCommit,
                        remoteCommit: checkResult.remoteCommit,
                    },
                };
            }
            if (!isForce) {
                // 기본 모드: 업데이트 가능 여부만 표시
                logger_1.logger.info(statusMessage);
                console.log('\n업데이트를 수행하려면 --force 옵션을 사용하세요:');
                console.log('  /impact update --force\n');
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: statusMessage,
                    data: {
                        available: true,
                        behind: checkResult.behind,
                        localCommit: checkResult.localCommit,
                        remoteCommit: checkResult.remoteCommit,
                    },
                };
            }
            // --force: 즉시 업데이트 수행
            logger_1.logger.info('업데이트를 시작합니다...');
            const updateResult = await this.performUpdate();
            if (updateResult.success) {
                const message = `KIC 업데이트 완료. (${updateResult.newCommit?.substring(0, 7)})`;
                logger_1.logger.success(message);
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message,
                    data: { updated: true, newCommit: updateResult.newCommit },
                };
            }
            else {
                logger_1.logger.error(`업데이트 실패: ${updateResult.message}`);
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: updateResult.message,
                };
            }
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`업데이트 중 오류 발생: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `업데이트 실패: ${errorMsg}`,
            };
        }
    }
    /**
     * 업데이트 가능 여부 확인
     * Git fetch 후 로컬과 원격 브랜치 비교
     */
    async checkForUpdate() {
        try {
            const { simpleGit } = await Promise.resolve().then(() => __importStar(require('simple-git')));
            const git = simpleGit(this.skillDir);
            // 타임아웃 5초로 fetch
            await Promise.race([
                git.fetch('origin'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout (5s)')), 5000)),
            ]);
            const status = await git.status();
            const behind = status.behind;
            // 로컬 커밋 해시
            const localLog = await git.log({ maxCount: 1 });
            const localCommit = localLog.latest?.hash || 'unknown';
            if (behind === 0) {
                return {
                    available: false,
                    localCommit,
                };
            }
            // 원격 최신 커밋 해시
            const remoteLog = await git.log({ maxCount: 1, from: 'origin/main' });
            const remoteCommit = remoteLog.latest?.hash || 'unknown';
            return {
                available: true,
                behind,
                localCommit,
                remoteCommit,
            };
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            return {
                available: false,
                skipped: true,
                reason,
            };
        }
    }
    /**
     * 업데이트 수행
     * git pull → npm install → npm run build
     */
    async performUpdate() {
        try {
            // Step 1: git pull
            logger_1.logger.info('1/3 소스 코드 업데이트 중...');
            const { simpleGit } = await Promise.resolve().then(() => __importStar(require('simple-git')));
            const git = simpleGit(this.skillDir);
            await git.pull('origin', 'main');
            // Step 2: npm install
            logger_1.logger.info('2/3 의존성 설치 중...');
            (0, child_process_1.execSync)('npm install --production', {
                cwd: this.skillDir,
                timeout: 60000,
                stdio: 'pipe',
            });
            // Step 3: npm run build
            logger_1.logger.info('3/3 빌드 중...');
            (0, child_process_1.execSync)('npm run build', {
                cwd: this.skillDir,
                timeout: 60000,
                stdio: 'pipe',
            });
            // 업데이트 후 커밋 해시 조회
            const log = await git.log({ maxCount: 1 });
            const newCommit = log.latest?.hash || 'unknown';
            return {
                success: true,
                message: `KIC 업데이트 완료. (${newCommit.substring(0, 7)})`,
                newCommit,
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                message: `업데이트 수행 실패: ${errorMsg}`,
            };
        }
    }
}
exports.UpdateCommand = UpdateCommand;
//# sourceMappingURL=update.js.map