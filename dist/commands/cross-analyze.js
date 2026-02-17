"use strict";
/**
 * @module commands/cross-analyze
 * @description CrossAnalyze 명령어 핸들러 - 크로스 프로젝트 영향도 분석
 *
 * 기능:
 *   - 소스 프로젝트 기준으로 연결된 프로젝트 간 영향도 분석
 *   - --source <project-id>: 소스 프로젝트 지정 (기본: 활성 프로젝트)
 *   - --group <group-name>: 특정 그룹 대상으로 분석
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossAnalyzeCommand = void 0;
const common_1 = require("../types/common");
const cross_project_manager_1 = require("../core/cross-project/cross-project-manager");
const api_contract_checker_1 = require("../core/cross-project/api-contract-checker");
const cross_analyzer_1 = require("../core/cross-project/cross-analyzer");
const indexer_1 = require("../core/indexing/indexer");
const config_manager_1 = require("../config/config-manager");
const logger_1 = require("../utils/logger");
/** ANSI 색상 코드 */
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};
/** 영향 수준별 색상 매핑 */
const IMPACT_COLORS = {
    critical: COLORS.red,
    high: COLORS.yellow,
    medium: COLORS.blue,
    low: COLORS.green,
};
/** 심각도별 색상 매핑 */
const SEVERITY_COLORS = {
    critical: COLORS.red,
    warning: COLORS.yellow,
    info: COLORS.cyan,
};
/**
 * CrossAnalyzeCommand - 크로스 프로젝트 영향도 분석 명령어
 *
 * 사용법:
 *   /impact cross-analyze                          - 활성 프로젝트 기준 분석
 *   /impact cross-analyze --source <project-id>   - 특정 소스 프로젝트 기준 분석
 *   /impact cross-analyze --group <group-name>    - 특정 그룹 대상으로 분석
 */
class CrossAnalyzeCommand {
    constructor(args) {
        this.name = 'cross-analyze';
        this.description = '크로스 프로젝트 영향도 분석';
        this.args = args;
    }
    async execute() {
        try {
            // 1. 옵션 파싱
            const sourceIdx = this.args.indexOf('--source');
            const groupIdx = this.args.indexOf('--group');
            let sourceProjectId;
            let groupName;
            if (sourceIdx !== -1 && this.args[sourceIdx + 1]) {
                sourceProjectId = this.args[sourceIdx + 1];
            }
            if (groupIdx !== -1 && this.args[groupIdx + 1]) {
                groupName = this.args[groupIdx + 1];
            }
            // 2. 소스 프로젝트 확인
            if (!sourceProjectId) {
                sourceProjectId = (await this.getActiveProjectId()) || undefined;
            }
            if (!sourceProjectId) {
                logger_1.logger.error('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
                return {
                    code: common_1.ResultCode.NEEDS_CONFIG,
                    message: '프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.',
                };
            }
            // 3. CrossAnalyzer 생성 및 실행
            const manager = new cross_project_manager_1.CrossProjectManager();
            const contractChecker = new api_contract_checker_1.ApiContractChecker();
            const analyzer = new cross_analyzer_1.CrossAnalyzer(manager, contractChecker);
            const indexer = new indexer_1.Indexer();
            // 4. 링크 존재 여부 확인
            const links = await manager.getLinks(sourceProjectId);
            if (links.length === 0) {
                logger_1.logger.header('크로스 프로젝트 영향도 분석');
                console.log('');
                console.log('  등록된 크로스 프로젝트 의존성이 없습니다.');
                console.log('');
                console.log('  의존성을 등록하려면:');
                console.log('    /impact projects --link <source> <target> --type api-consumer');
                console.log('');
                console.log('  자동 감지를 실행하려면:');
                console.log('    /impact projects --detect-links');
                console.log('');
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: '등록된 크로스 프로젝트 의존성이 없습니다.',
                    data: { affectedProjects: [], apiContractChanges: [] },
                };
            }
            // 5. 분석 실행
            const result = await analyzer.analyze(sourceProjectId, indexer, {
                groupName,
            });
            // 6. 결과 출력
            this.printResult(sourceProjectId, result, groupName);
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `크로스 프로젝트 분석 완료: ${result.affectedProjects.length}개 프로젝트 영향`,
                data: result,
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`크로스 프로젝트 분석 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Cross-analyze failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 분석 결과 출력
     */
    printResult(sourceProjectId, result, groupName) {
        logger_1.logger.header('크로스 프로젝트 영향도 분석');
        console.log(`\n  소스 프로젝트: ${sourceProjectId}`);
        if (groupName) {
            console.log(`  그룹 필터: ${groupName}`);
        }
        console.log('');
        // 영향받는 프로젝트 목록
        if (result.affectedProjects.length === 0) {
            console.log('  영향받는 프로젝트가 없습니다.');
            console.log('');
            return;
        }
        console.log('  [영향받는 프로젝트]');
        for (const proj of result.affectedProjects) {
            const color = IMPACT_COLORS[proj.impactLevel] || COLORS.reset;
            console.log(`    ${color}[${proj.impactLevel.toUpperCase()}]${COLORS.reset} ${proj.projectName} (${proj.projectId})`);
            console.log(`           API: ${proj.affectedApis.length}개, 컴포넌트: ${proj.affectedComponents}개`);
            console.log(`           ${proj.summary}`);
        }
        console.log('');
        // API 계약 변경 목록
        if (result.apiContractChanges.length > 0) {
            console.log('  [API 계약 변경]');
            for (const change of result.apiContractChanges) {
                const color = SEVERITY_COLORS[change.severity] || COLORS.reset;
                const changeLabel = this.getChangeLabel(change.changeType);
                console.log(`    ${color}[${change.severity.toUpperCase()}]${COLORS.reset} ${changeLabel} ${change.apiPath}`);
                if (change.consumers.length > 0) {
                    console.log(`           영향 받는 프로젝트: ${change.consumers.join(', ')}`);
                }
            }
            console.log('');
        }
        // 요약 통계
        console.log('  [요약]');
        console.log(`    영향 프로젝트: ${result.affectedProjects.length}개`);
        console.log(`    API 계약 변경: ${result.apiContractChanges.length}건`);
        const criticalCount = result.apiContractChanges.filter((c) => c.severity === 'critical').length;
        const warningCount = result.apiContractChanges.filter((c) => c.severity === 'warning').length;
        const infoCount = result.apiContractChanges.filter((c) => c.severity === 'info').length;
        if (criticalCount > 0) {
            console.log(`    ${COLORS.red}Critical: ${criticalCount}건${COLORS.reset}`);
        }
        if (warningCount > 0) {
            console.log(`    ${COLORS.yellow}Warning: ${warningCount}건${COLORS.reset}`);
        }
        if (infoCount > 0) {
            console.log(`    ${COLORS.cyan}Info: ${infoCount}건${COLORS.reset}`);
        }
        console.log('');
    }
    /**
     * 변경 유형 라벨
     */
    getChangeLabel(changeType) {
        switch (changeType) {
            case 'add':
                return '[추가]';
            case 'modify':
                return '[수정]';
            case 'remove':
                return '[삭제]';
            default:
                return `[${changeType}]`;
        }
    }
    /**
     * 활성 프로젝트 ID 가져오기
     */
    async getActiveProjectId() {
        try {
            const configManager = new config_manager_1.ConfigManager();
            await configManager.load();
            return configManager.getActiveProject();
        }
        catch {
            return null;
        }
    }
}
exports.CrossAnalyzeCommand = CrossAnalyzeCommand;
//# sourceMappingURL=cross-analyze.js.map