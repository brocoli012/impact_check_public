"use strict";
/**
 * @module commands/owners
 * @description Owners 명령어 핸들러 - 시스템별 담당자 관리 (CRUD)
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
exports.OwnersCommand = void 0;
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const config_manager_1 = require("../config/config-manager");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * OwnersCommand - 담당자 관리 명령어
 *
 * 사용법:
 *   /impact owners                   - 담당자 목록 조회
 *   /impact owners --show <systemId> - 담당자 상세 조회
 *   /impact owners --add <systemId> <systemName> <ownerName> <email> <team> <paths...>
 *   /impact owners --remove <systemId> - 담당자 삭제
 */
class OwnersCommand {
    constructor(args) {
        this.name = 'owners';
        this.description = '시스템별 담당자 및 팀 정보를 관리합니다.';
        this.args = args;
    }
    async execute() {
        try {
            // 활성 프로젝트 확인
            const configManager = new config_manager_1.ConfigManager();
            await configManager.load();
            const projectId = configManager.getActiveProject();
            if (!projectId) {
                logger_1.logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: 'No active project. Run /impact init first.',
                };
            }
            const ownersPath = path.join((0, file_1.getProjectDir)(projectId), 'owners.json');
            // --add 처리
            if (this.args.includes('--add')) {
                return this.handleAdd(ownersPath);
            }
            // --remove 처리
            const removeIdx = this.args.indexOf('--remove');
            if (removeIdx !== -1) {
                const systemId = this.args[removeIdx + 1];
                if (!systemId) {
                    logger_1.logger.error('삭제할 시스템 ID를 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: 'System ID is required for --remove.',
                    };
                }
                return this.handleRemove(ownersPath, systemId);
            }
            // --show 처리
            const showIdx = this.args.indexOf('--show');
            if (showIdx !== -1) {
                const systemId = this.args[showIdx + 1];
                if (!systemId) {
                    logger_1.logger.error('조회할 시스템 ID를 지정해주세요.');
                    return {
                        code: common_1.ResultCode.FAILURE,
                        message: 'System ID is required for --show.',
                    };
                }
                return this.handleShow(ownersPath, systemId);
            }
            // 기본: 목록 조회
            return this.handleList(ownersPath);
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`담당자 관리 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Owners command failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 담당자 목록 조회
     */
    handleList(ownersPath) {
        const config = this.loadOwners(ownersPath);
        logger_1.logger.header('시스템 담당자 목록');
        if (config.owners.length === 0) {
            console.log('\n등록된 담당자가 없습니다.');
            console.log('담당자 추가: /impact owners --add <systemId> <systemName> <ownerName> <email> <team> [paths...]');
        }
        else {
            console.log('');
            for (const owner of config.owners) {
                console.log(`  ${owner.systemId.padEnd(20)} ${owner.ownerName.padEnd(12)} ${owner.team.padEnd(12)} ${owner.email}`);
            }
            console.log(`\n총 ${config.owners.length}명의 담당자가 등록되어 있습니다.`);
        }
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Listed ${config.owners.length} owners.`,
            data: { owners: config.owners },
        };
    }
    /**
     * 담당자 상세 조회
     */
    handleShow(ownersPath, systemId) {
        const config = this.loadOwners(ownersPath);
        const owner = config.owners.find(o => o.systemId === systemId);
        if (!owner) {
            logger_1.logger.error(`담당자를 찾을 수 없습니다: ${systemId}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Owner not found: ${systemId}`,
            };
        }
        logger_1.logger.header(`담당자 상세 - ${owner.systemName}`);
        console.log(`\n  시스템 ID:   ${owner.systemId}`);
        console.log(`  시스템 이름: ${owner.systemName}`);
        console.log(`  담당자:      ${owner.ownerName}`);
        console.log(`  이메일:      ${owner.email}`);
        console.log(`  팀:          ${owner.team}`);
        if (owner.paths.length > 0) {
            console.log('  담당 경로:');
            for (const p of owner.paths) {
                console.log(`    - ${p}`);
            }
        }
        console.log('');
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Showing owner: ${systemId}`,
            data: { owner },
        };
    }
    /**
     * 담당자 추가
     * --add <systemId> <systemName> <ownerName> <email> <team> [paths...]
     */
    handleAdd(ownersPath) {
        const addIdx = this.args.indexOf('--add');
        const params = this.args.slice(addIdx + 1);
        if (params.length < 5) {
            logger_1.logger.error('담당자 추가에 필요한 정보가 부족합니다.');
            console.log('\n사용법: /impact owners --add <systemId> <systemName> <ownerName> <email> <team> [paths...]');
            return {
                code: common_1.ResultCode.FAILURE,
                message: 'Insufficient parameters for --add.',
            };
        }
        const [systemId, systemName, ownerName, email, team, ...paths] = params;
        const config = this.loadOwners(ownersPath);
        // 중복 확인
        const existing = config.owners.find(o => o.systemId === systemId);
        if (existing) {
            logger_1.logger.error(`이미 등록된 시스템입니다: ${systemId}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `System already exists: ${systemId}`,
            };
        }
        const newOwner = {
            systemId,
            systemName,
            ownerName,
            email,
            team,
            paths: paths.length > 0 ? paths : [],
        };
        config.owners.push(newOwner);
        this.saveOwners(ownersPath, config);
        logger_1.logger.success(`담당자가 추가되었습니다: ${systemName} (${ownerName})`);
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Owner added: ${systemId}`,
            data: { owner: newOwner },
        };
    }
    /**
     * 담당자 삭제
     */
    handleRemove(ownersPath, systemId) {
        const config = this.loadOwners(ownersPath);
        const idx = config.owners.findIndex(o => o.systemId === systemId);
        if (idx === -1) {
            logger_1.logger.error(`담당자를 찾을 수 없습니다: ${systemId}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Owner not found: ${systemId}`,
            };
        }
        const removed = config.owners.splice(idx, 1)[0];
        this.saveOwners(ownersPath, config);
        logger_1.logger.success(`담당자가 삭제되었습니다: ${removed.systemName} (${removed.ownerName})`);
        return {
            code: common_1.ResultCode.SUCCESS,
            message: `Owner removed: ${systemId}`,
            data: { removed },
        };
    }
    /**
     * 담당자 설정 파일 로드
     */
    loadOwners(ownersPath) {
        const config = (0, file_1.readJsonFile)(ownersPath);
        return config || { owners: [] };
    }
    /**
     * 담당자 설정 파일 저장
     */
    saveOwners(ownersPath, config) {
        (0, file_1.ensureDir)(path.dirname(ownersPath));
        (0, file_1.writeJsonFile)(ownersPath, config);
    }
}
exports.OwnersCommand = OwnersCommand;
//# sourceMappingURL=owners.js.map