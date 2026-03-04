"use strict";
/**
 * @module commands/status
 * @description Status 명령어 핸들러 - 등록된 프로젝트 상태 요약 표시
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
exports.StatusCommand = void 0;
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const result_manager_1 = require("../core/analysis/result-manager");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * StatusCommand - 프로젝트 상태 요약 명령어
 *
 * 사용법: /impact status
 * 기능:
 *   - 등록된 프로젝트 목록 및 상태 요약
 *   - 프로젝트별 분석 건수, 최근 분석 등급/점수/날짜
 *   - 최근 분석 5건 (전체 프로젝트 합산)
 *   - 프로젝트 수에 따른 출력 형식 분기
 */
class StatusCommand {
    constructor(_args) {
        this.name = 'status';
        this.description = '등록된 프로젝트 상태 요약을 표시합니다.';
    }
    async execute() {
        try {
            // 1. projects.json 읽기
            const impactDir = (0, file_1.getImpactDir)();
            const projectsPath = path.join(impactDir, 'projects.json');
            const projectsConfig = (0, file_1.readJsonFile)(projectsPath);
            if (!projectsConfig || !projectsConfig.projects || projectsConfig.projects.length === 0) {
                const message = '등록된 프로젝트가 없습니다.';
                logger_1.logger.info(message);
                console.log(`\n${message}`);
                console.log('프로젝트를 등록하려면: /impact init <project_path>\n');
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message,
                    data: { projectCount: 0 },
                };
            }
            const activeProjectId = projectsConfig.activeProject;
            const resultManager = new result_manager_1.ResultManager();
            // 2. 각 프로젝트별 요약 수집
            const projectStatuses = [];
            const allRecentAnalyses = [];
            for (const project of projectsConfig.projects) {
                const summaries = await resultManager.list(project.id);
                // 최신순 정렬
                const sorted = [...summaries].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
                const statusInfo = {
                    id: project.id,
                    name: project.name,
                    projectPath: project.path,
                    analysisCount: summaries.length,
                    isActive: project.id === activeProjectId,
                };
                if (sorted.length > 0) {
                    statusInfo.latestAnalysis = {
                        grade: sorted[0].grade,
                        totalScore: sorted[0].totalScore,
                        analyzedAt: sorted[0].analyzedAt,
                    };
                }
                projectStatuses.push(statusInfo);
                // 전체 합산을 위해 모든 분석 결과 수집
                for (const summary of summaries) {
                    allRecentAnalyses.push({
                        projectId: project.id,
                        projectName: project.name,
                        summary,
                    });
                }
            }
            // 3. 출력
            logger_1.logger.header('Impact Checker - 프로젝트 상태');
            const projectCount = projectStatuses.length;
            if (projectCount < 7) {
                this.renderList(projectStatuses);
            }
            else {
                this.renderTable(projectStatuses);
            }
            // 4. 최근 분석 5건 (전체 프로젝트 합산, analyzedAt 내림차순)
            if (allRecentAnalyses.length > 0) {
                const recent = allRecentAnalyses
                    .sort((a, b) => new Date(b.summary.analyzedAt).getTime() -
                    new Date(a.summary.analyzedAt).getTime())
                    .slice(0, 5);
                console.log('\n최근 분석 (최대 5건):');
                logger_1.logger.separator();
                for (const item of recent) {
                    const date = new Date(item.summary.analyzedAt).toLocaleDateString('ko-KR');
                    console.log(`  [${item.summary.grade}] ${item.summary.specTitle} ` +
                        `(${item.projectName}, ${item.summary.totalScore}점, ${date})`);
                }
                console.log('');
            }
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `${projectCount}개 프로젝트 상태 조회 완료.`,
                data: {
                    projectCount,
                    projects: projectStatuses,
                },
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`상태 조회 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Status command failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 리스트 형식 출력 (1~6개 프로젝트)
     */
    renderList(projects) {
        console.log(`\n등록된 프로젝트 (${projects.length}개):\n`);
        for (const p of projects) {
            const activeMarker = p.isActive ? ' *' : '';
            const analysisInfo = p.latestAnalysis
                ? `최근: [${p.latestAnalysis.grade}] ${p.latestAnalysis.totalScore}점 ` +
                    `(${new Date(p.latestAnalysis.analyzedAt).toLocaleDateString('ko-KR')})`
                : '분석 없음';
            console.log(`  ${p.name}${activeMarker} (${p.id})`);
            console.log(`    경로: ${p.projectPath}`);
            console.log(`    분석: ${p.analysisCount}건 | ${analysisInfo}`);
            console.log('');
        }
    }
    /**
     * 테이블 형식 출력 (7개+ 프로젝트)
     */
    renderTable(projects) {
        console.log(`\n등록된 프로젝트 (${projects.length}개):\n`);
        // 헤더
        const header = [
            ''.padEnd(2),
            '프로젝트'.padEnd(20),
            '분석'.padEnd(6),
            '등급'.padEnd(6),
            '점수'.padEnd(8),
            '최근 분석일',
        ].join(' ');
        console.log(header);
        logger_1.logger.separator();
        for (const p of projects) {
            const activeMarker = p.isActive ? '* ' : '  ';
            const name = p.name.length > 18 ? p.name.substring(0, 17) + '...' : p.name.padEnd(20);
            const count = String(p.analysisCount).padEnd(6);
            const grade = (p.latestAnalysis?.grade || '-').padEnd(6);
            const score = (p.latestAnalysis ? String(p.latestAnalysis.totalScore) : '-').padEnd(8);
            const date = p.latestAnalysis
                ? new Date(p.latestAnalysis.analyzedAt).toLocaleDateString('ko-KR')
                : '-';
            console.log(`${activeMarker}${name} ${count} ${grade} ${score} ${date}`);
        }
        console.log('');
        console.log('  * = 활성 프로젝트');
        console.log('');
    }
}
exports.StatusCommand = StatusCommand;
//# sourceMappingURL=status.js.map