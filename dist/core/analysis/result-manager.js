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
    async save(result, projectId, title) {
        const resultsDir = this.getResultsDir(projectId);
        (0, file_1.ensureDir)(resultsDir);
        const resultId = result.analysisId || `analysis-${Date.now()}`;
        const filePath = path.join(resultsDir, `${resultId}.json`);
        (0, file_1.writeJsonFile)(filePath, result);
        // 인덱스 파일 업데이트
        await this.updateIndex(projectId, {
            id: resultId,
            specTitle: title || result.specTitle,
            analyzedAt: result.analyzedAt,
            totalScore: result.totalScore,
            grade: result.grade,
            affectedScreenCount: result.affectedScreens.length,
            taskCount: result.tasks.length,
        });
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
            summaries[existingIndex] = summary;
        }
        else {
            summaries.push(summary);
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