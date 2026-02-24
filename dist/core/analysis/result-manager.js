"use strict";
/**
 * @module core/analysis/result-manager
 * @description 결과 관리자 - 분석 결과 저장/로드/목록 조회
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
exports.ResultManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analysis_status_1 = require("../../utils/analysis-status");
const file_1 = require("../../utils/file");
const logger_1 = require("../../utils/logger");
/**
 * ResultManager - 분석 결과 관리
 *
 * .impact/projects/{projectId}/results/ 디렉토리에
 * 분석 결과를 JSON으로 저장하고 로드.
 *
 * Design note: Methods are async for future migration to async I/O
 * (fs.promises). Currently uses synchronous I/O (fs.existsSync,
 * readJsonFile/writeJsonFile which wrap fs.readFileSync/writeFileSync)
 * for simplicity. The async signatures allow callers to be written
 * against the future-proof contract without a breaking change later.
 */
class ResultManager {
    constructor(basePath) {
        this.basePath = basePath;
    }
    /**
     * 결과 저장
     * @param result - 분석 결과
     * @param projectId - 프로젝트 ID
     * @param title - 결과 제목 (선택)
     * @returns 결과 ID
     */
    async save(result, projectId, title, defaultStatus) {
        const resultsDir = this.getResultsDir(projectId);
        (0, file_1.ensureDir)(resultsDir);
        const resultId = result.analysisId || `analysis-${Date.now()}`;
        const filePath = path.join(resultsDir, `${resultId}.json`);
        (0, file_1.writeJsonFile)(filePath, result);
        // 인덱스 파일 업데이트
        // defaultStatus가 명시적으로 전달된 경우에만 status를 설정하고,
        // 그렇지 않으면 undefined로 두어 updateIndex에서 기존 값을 보존하도록 함
        const summaryForIndex = {
            id: resultId,
            specTitle: title || result.specTitle,
            analyzedAt: result.analyzedAt,
            totalScore: result.totalScore,
            grade: result.grade,
            affectedScreenCount: result.affectedScreens.length,
            taskCount: result.tasks.length,
        };
        // 명시적 defaultStatus가 있으면 설정, 없으면 신규 항목에서만 'active' 적용
        if (defaultStatus !== undefined) {
            summaryForIndex.status = defaultStatus;
        }
        await this.updateIndex(projectId, summaryForIndex);
        logger_1.logger.info(`Result saved: ${filePath}`);
        return resultId;
    }
    /**
     * 최신 결과 로드
     * @param projectId - 프로젝트 ID
     * @returns 최신 결과 또는 null
     */
    async getLatest(projectId) {
        const summaries = await this.list(projectId);
        if (summaries.length === 0)
            return null;
        // 최신순 정렬
        summaries.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
        return this.getById(projectId, summaries[0].id);
    }
    /**
     * ID로 결과 로드
     * @param projectId - 프로젝트 ID
     * @param resultId - 결과 ID
     * @returns 분석 결과 또는 null
     */
    async getById(projectId, resultId) {
        const filePath = path.join(this.getResultsDir(projectId), `${resultId}.json`);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        try {
            return (0, file_1.readJsonFile)(filePath);
        }
        catch (err) {
            logger_1.logger.error(`Failed to load result ${resultId}:`, err);
            return null;
        }
    }
    /**
     * 결과 목록 조회
     * @param projectId - 프로젝트 ID
     * @returns 결과 요약 목록
     */
    async list(projectId) {
        const indexPath = this.getIndexPath(projectId);
        if (!fs.existsSync(indexPath)) {
            return [];
        }
        try {
            const summaries = (0, file_1.readJsonFile)(indexPath);
            return summaries || [];
        }
        catch {
            return [];
        }
    }
    /**
     * 크로스 프로젝트 탐지 결과를 특정 분석 결과 요약에 기록
     * @param projectId - 프로젝트 ID
     * @param resultId - 결과 ID
     * @param detection - 크로스 프로젝트 탐지 정보
     */
    async updateCrossProjectDetection(projectId, resultId, detection) {
        const indexPath = this.getIndexPath(projectId);
        if (!fs.existsSync(indexPath))
            return;
        const summaries = (0, file_1.readJsonFile)(indexPath) || [];
        const idx = summaries.findIndex(s => s.id === resultId);
        if (idx >= 0) {
            summaries[idx] = { ...summaries[idx], crossProjectDetection: detection };
            (0, file_1.writeJsonFile)(indexPath, summaries);
        }
    }
    /**
     * 유효 상태 조회 (Lazy Migration 지원)
     * status 필드가 없는 기존 데이터는 'active'로 간주
     */
    getEffectiveStatus(summary) {
        return (0, analysis_status_1.getEffectiveStatus)(summary.status);
    }
    /**
     * 분석 결과 상태 변경
     * @param projectId - 프로젝트 ID
     * @param analysisId - 분석 결과 ID
     * @param newStatus - 새 상태
     * @returns 업데이트된 ResultSummary
     * @throws 유효하지 않은 전환 또는 결과 미존재 시 Error
     */
    async updateStatus(projectId, analysisId, newStatus) {
        const indexPath = this.getIndexPath(projectId);
        const summaries = (0, file_1.readJsonFile)(indexPath) || [];
        const idx = summaries.findIndex(s => s.id === analysisId);
        if (idx < 0) {
            throw new Error(`분석 결과를 찾을 수 없습니다: ${analysisId}`);
        }
        const current = summaries[idx];
        const currentStatus = (0, analysis_status_1.getEffectiveStatus)(current.status);
        if (!(0, analysis_status_1.isValidTransition)(currentStatus, newStatus)) {
            throw new Error((0, analysis_status_1.getTransitionError)(currentStatus, newStatus));
        }
        summaries[idx] = {
            ...current,
            status: newStatus,
            statusChangedAt: new Date().toISOString(),
        };
        (0, file_1.writeJsonFile)(indexPath, summaries);
        return summaries[idx];
    }
    /**
     * active 상태의 최신 분석 반환
     * [R4-07] archived 제외 - archived만 남은 프로젝트 대응
     */
    async getLatestActive(projectId) {
        const summaries = await this.list(projectId);
        const activeSummaries = summaries.filter(s => (0, analysis_status_1.getEffectiveStatus)(s.status) === 'active');
        if (activeSummaries.length === 0)
            return null;
        return activeSummaries.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())[0];
    }
    /**
     * 상태별 분석 결과 목록 조회
     * @param projectId - 프로젝트 ID
     * @param status - 필터할 상태 (미지정 시 전체 반환)
     */
    async listByStatus(projectId, status) {
        const summaries = await this.list(projectId);
        if (!status)
            return summaries;
        return summaries.filter(s => (0, analysis_status_1.getEffectiveStatus)(s.status) === status);
    }
    /**
     * analysisId로 프로젝트 ID 역매핑
     * 모든 프로젝트의 인덱스를 순회하여 검색
     */
    async findByAnalysisId(analysisId) {
        const projectsPath = path.join(this.basePath || process.env.HOME || '', '.impact', 'projects.json');
        const config = (0, file_1.readJsonFile)(projectsPath);
        if (!config?.projects)
            return null;
        for (const project of config.projects) {
            const summaries = await this.list(project.id);
            const found = summaries.find(s => s.id === analysisId);
            if (found) {
                return { projectId: project.id, summary: found };
            }
        }
        return null;
    }
    /**
     * 보완 분석 결과 저장
     *
     * supplement-{originalAnalysisId}.json 형식으로 저장하고,
     * 인덱스에 isSupplement, supplementOf, triggerProject를 기록한다.
     *
     * @param projectId - 프로젝트 ID (보완 분석 대상 프로젝트)
     * @param originalAnalysisId - 원본 분석 ID
     * @param result - 보완 분석 결과
     * @returns 저장된 파일 경로
     */
    async saveSupplementResult(projectId, originalAnalysisId, result) {
        const resultsDir = this.getResultsDir(projectId);
        (0, file_1.ensureDir)(resultsDir);
        const supplementId = `supplement-${originalAnalysisId}`;
        const filePath = path.join(resultsDir, `${supplementId}.json`);
        // 보완 분석 메타데이터 설정
        const supplementResult = {
            ...result,
            supplementOf: originalAnalysisId,
            triggerProject: result.triggerProject,
        };
        (0, file_1.writeJsonFile)(filePath, supplementResult);
        // 인덱스에 보완 분석 정보 기록
        const summaryForIndex = {
            id: supplementId,
            specTitle: result.specTitle,
            analyzedAt: result.analyzedAt,
            totalScore: result.totalScore,
            grade: result.grade,
            affectedScreenCount: result.affectedScreens.length,
            taskCount: result.tasks.length,
            status: 'active',
            isSupplement: true,
            supplementOf: originalAnalysisId,
            triggerProject: result.triggerProject,
        };
        await this.updateIndex(projectId, summaryForIndex);
        logger_1.logger.info(`Supplement result saved: ${filePath}`);
        return filePath;
    }
    /**
     * 특정 분석의 보완 분석 결과 조회
     *
     * @param projectId - 프로젝트 ID
     * @param originalAnalysisId - 원본 분석 ID
     * @returns 보완 분석 결과 목록
     */
    async getSupplementResults(projectId, originalAnalysisId) {
        const resultsDir = this.getResultsDir(projectId);
        const supplementId = `supplement-${originalAnalysisId}`;
        const filePath = path.join(resultsDir, `${supplementId}.json`);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        try {
            const result = (0, file_1.readJsonFile)(filePath);
            return result ? [result] : [];
        }
        catch (err) {
            logger_1.logger.error(`Failed to load supplement result for ${originalAnalysisId}:`, err);
            return [];
        }
    }
    /**
     * 보완 분석 결과인지 확인
     *
     * @param resultId - 결과 ID
     * @returns 보완 분석 결과 여부
     */
    isSupplementResult(resultId) {
        return resultId.startsWith('supplement-');
    }
    /**
     * 인덱스 파일 업데이트
     */
    async updateIndex(projectId, summary) {
        const indexPath = this.getIndexPath(projectId);
        let summaries = [];
        if (fs.existsSync(indexPath)) {
            summaries = (0, file_1.readJsonFile)(indexPath) || [];
        }
        // 기존 항목이 있으면 업데이트, 없으면 추가
        const existingIndex = summaries.findIndex(s => s.id === summary.id);
        if (existingIndex >= 0) {
            // 기존 필드 보존 (새 summary에 없으면 기존 값 유지)
            const existing = summaries[existingIndex];
            summaries[existingIndex] = {
                ...summary,
                crossProjectDetection: summary.crossProjectDetection ?? existing.crossProjectDetection,
                status: summary.status ?? existing.status,
                statusChangedAt: summary.statusChangedAt ?? existing.statusChangedAt,
                isSupplement: summary.isSupplement ?? existing.isSupplement,
                supplementOf: summary.supplementOf ?? existing.supplementOf,
                triggerProject: summary.triggerProject ?? existing.triggerProject,
            };
        }
        else {
            // 신규 항목: status가 없으면 'active'로 기본 설정
            summaries.push({
                ...summary,
                status: summary.status ?? 'active',
            });
        }
        (0, file_1.writeJsonFile)(indexPath, summaries);
    }
    /**
     * 결과 디렉토리 경로
     */
    getResultsDir(projectId) {
        return path.join((0, file_1.getProjectDir)(projectId, this.basePath), 'results');
    }
    /**
     * 인덱스 파일 경로
     */
    getIndexPath(projectId) {
        return path.join(this.getResultsDir(projectId), 'index.json');
    }
}
exports.ResultManager = ResultManager;
//# sourceMappingURL=result-manager.js.map