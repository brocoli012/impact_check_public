"use strict";
/**
 * @module commands/view
 * @description View 명령어 핸들러 - 분석 결과 시각화 웹을 실행
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
exports.ViewCommand = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const common_1 = require("../types/common");
const web_server_1 = require("../server/web-server");
const config_manager_1 = require("../config/config-manager");
const result_manager_1 = require("../core/analysis/result-manager");
const logger_1 = require("../utils/logger");
/**
 * 브라우저에서 URL을 열기 (OS별 처리)
 * @param url - 열 URL
 */
function openBrowser(url) {
    const platform = os.platform();
    let command;
    switch (platform) {
        case 'darwin':
            command = `open "${url}"`;
            break;
        case 'win32':
            command = `start "${url}"`;
            break;
        default:
            // Linux and others
            command = `xdg-open "${url}"`;
            break;
    }
    (0, child_process_1.exec)(command, (err) => {
        if (err) {
            logger_1.logger.warn(`Could not open browser automatically. Please visit: ${url}`);
        }
    });
}
/**
 * ViewCommand - 시각화 웹 서버 명령어
 *
 * 사용법: /impact view [--stop]
 * 기능:
 *   - Express.js 웹 서버 시작
 *   - React SPA 정적 파일 서빙
 *   - 브라우저 자동 열기
 */
class ViewCommand {
    constructor(args) {
        this.name = 'view';
        this.description = '분석 결과 시각화 웹을 실행합니다.';
        this.args = args;
    }
    async execute() {
        const isStop = this.args.includes('--stop');
        if (isStop) {
            return this.handleStop();
        }
        return this.handleStart();
    }
    /**
     * 서버 시작 처리
     */
    async handleStart() {
        // 이미 실행 중인지 확인
        if ((0, web_server_1.isServerRunning)()) {
            console.log('\n웹 서버가 이미 실행 중입니다.');
            console.log('중지하려면: /impact view --stop');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'Web server is already running.',
            };
        }
        // web/dist 빌드 존재 여부 확인
        const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');
        if (!fs.existsSync(webDistPath)) {
            console.warn('\n⚠️ 웹 대시보드 빌드가 필요합니다. 아래 명령어를 실행해주세요:');
            console.warn('   cd web && npm install && npm run build');
            console.warn('');
        }
        // 분석 결과가 있는지 확인
        const configManager = new config_manager_1.ConfigManager();
        await configManager.load();
        const projectId = configManager.getActiveProject();
        if (!projectId) {
            console.log('\n활성 프로젝트가 없습니다.');
            console.log('먼저 프로젝트를 초기화해주세요: /impact init');
            return {
                code: common_1.ResultCode.NEEDS_CONFIG,
                message: 'No active project found.',
            };
        }
        // 결과 존재 여부 확인
        const resultManager = new result_manager_1.ResultManager();
        const results = await resultManager.list(projectId);
        if (results.length === 0) {
            console.log('\n📊 분석 결과가 없습니다. 먼저 /impact analyze를 실행하세요.');
            console.log('\n결과 없이 대시보드를 확인하시려면 데모 데이터로 표시합니다.');
        }
        // 설정에서 포트 가져오기
        const config = configManager.getConfig();
        const preferredPort = config.general.webPort || 3847;
        try {
            const port = await (0, web_server_1.startServer)(undefined, preferredPort);
            const url = `http://localhost:${port}`;
            console.log(`\n시각화 웹 서버가 시작되었습니다.`);
            console.log(`URL: ${url}`);
            console.log(`\n중지하려면: /impact view --stop`);
            // 브라우저 자동 열기
            openBrowser(url);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Web server started at ${url}`,
                data: { port, url },
            };
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Failed to start web server:', error);
            console.log(`\n웹 서버 시작에 실패했습니다: ${errMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Failed to start web server: ${errMsg}`,
            };
        }
    }
    /**
     * 서버 중지 처리
     */
    async handleStop() {
        if (!(0, web_server_1.isServerRunning)()) {
            console.log('\n실행 중인 웹 서버가 없습니다.');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'No web server is running.',
            };
        }
        try {
            await (0, web_server_1.stopServer)();
            console.log('\n웹 서버가 중지되었습니다.');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'Web server stopped.',
            };
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Failed to stop web server:', error);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Failed to stop web server: ${errMsg}`,
            };
        }
    }
}
exports.ViewCommand = ViewCommand;
//# sourceMappingURL=view.js.map