"use strict";
/**
 * @module commands/analyze
 * @description Analyze 명령어 핸들러 - 기획서를 입력받아 영향도를 분석
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
exports.AnalyzeCommand = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const pipeline_1 = require("../core/analysis/pipeline");
const logger_1 = require("../utils/logger");
const config_manager_1 = require("../config/config-manager");
/**
 * AnalyzeCommand - 영향도 분석 명령어
 *
 * 사용법: /impact analyze [--file <path>] [--project <id>]
 * 기능:
 *   - 기획서 파싱
 *   - 인덱스 매칭
 *   - 규칙 기반 영향도 분석
 *   - 점수 산출
 *   - 결과 저장
 */
class AnalyzeCommand {
    constructor(args) {
        this.name = 'analyze';
        this.description = '기획서를 입력받아 영향도를 분석합니다.';
        this.args = args;
    }
    async execute() {
        try {
            // 옵션 파싱
            const filePath = this.getOption('--file');
            const projectId = this.getOption('--project');
            // 기획서 입력 준비
            const specInput = await this.prepareSpecInput(filePath);
            if (!specInput) {
                return {
                    code: common_1.ResultCode.FAILURE,
                    message: '📄 기획서 파일을 지정해주세요: /impact analyze --file <파일경로>',
                };
            }
            // 설정 관리자 로드 (HOME 환경변수 우선 사용)
            const homePath = process.env.HOME || process.env.USERPROFILE;
            const configManager = new config_manager_1.ConfigManager(homePath || undefined);
            await configManager.load();
            // 활성 프로젝트 결정 (ConfigManager에 위임)
            const activeProjectId = projectId || configManager.getActiveProject();
            if (!activeProjectId) {
                return {
                    code: common_1.ResultCode.NEEDS_CONFIG,
                    message: '📂 먼저 프로젝트를 초기화하세요: /impact init <프로젝트경로>',
                };
            }
            // 파이프라인 실행
            const pipeline = new pipeline_1.AnalysisPipeline();
            pipeline.setProgressCallback((step, total, message) => {
                const percent = Math.round((step / total) * 100);
                console.log(`  [${step}/${total}] (${percent}%) ${message}`);
            });
            logger_1.logger.header('영향도 분석 시작');
            console.log(`  프로젝트: ${activeProjectId}`);
            console.log(`  입력 유형: ${specInput.type}`);
            console.log('');
            const result = await pipeline.run(specInput, activeProjectId);
            // 결과 저장
            const resultId = await pipeline.saveResult(result, activeProjectId);
            // 결과 요약 출력
            logger_1.logger.separator();
            console.log('');
            console.log(`  분석 완료!`);
            console.log(`  ─────────────────────────────────`);
            console.log(`  기획서: ${result.specTitle}`);
            console.log(`  총점: ${result.totalScore.toFixed(1)}`);
            console.log(`  등급: ${result.grade}`);
            console.log(`  영향 화면: ${result.affectedScreens.length}개`);
            console.log(`  작업 수: ${result.tasks.length}개`);
            console.log(`  정책 경고: ${result.policyWarnings.length}개`);
            console.log(`  담당자 알림: ${result.ownerNotifications.length}명`);
            console.log(`  ─────────────────────────────────`);
            console.log(`  권고: ${result.recommendation}`);
            console.log('');
            // 낮은 신뢰도 경고
            if (result.lowConfidenceWarnings.length > 0) {
                console.log(`  [주의] 낮은 신뢰도 항목:`);
                for (const w of result.lowConfidenceWarnings) {
                    console.log(`    - ${w.systemName}: ${w.reason}`);
                }
                console.log('');
            }
            console.log(`  결과 저장: ${resultId}`);
            console.log(`  상세 확인: /impact view --result ${resultId}`);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `분석 완료. 등급: ${result.grade}, 총점: ${result.totalScore.toFixed(1)}`,
                data: result,
            };
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`Analysis failed: ${errMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `분석 실패: ${errMsg}`,
            };
        }
    }
    /**
     * 기획서 입력 준비
     */
    async prepareSpecInput(filePath) {
        if (filePath) {
            const absPath = path.resolve(filePath);
            if (!fs.existsSync(absPath)) {
                console.log(`  ❌ 파일을 찾을 수 없습니다: ${absPath}`);
                return null;
            }
            const ext = path.extname(absPath).toLowerCase();
            if (ext === '.pdf') {
                return { type: 'pdf', filePath: absPath };
            }
            // 텍스트 파일로 읽기
            const content = fs.readFileSync(absPath, 'utf-8');
            return { type: 'text', content };
        }
        // 인자에서 텍스트 가져오기
        const textArgs = this.args.filter(a => !a.startsWith('--'));
        if (textArgs.length > 0) {
            return { type: 'text', content: textArgs.join(' ') };
        }
        // stdin 안내
        console.log('');
        console.log('  사용법:');
        console.log('    /impact analyze --file <기획서.txt>');
        console.log('    /impact analyze --file <기획서.pdf>');
        console.log('');
        return null;
    }
    /**
     * 옵션 값 가져오기
     */
    getOption(name) {
        const idx = this.args.indexOf(name);
        if (idx !== -1 && this.args[idx + 1]) {
            return this.args[idx + 1];
        }
        return undefined;
    }
}
exports.AnalyzeCommand = AnalyzeCommand;
//# sourceMappingURL=analyze.js.map