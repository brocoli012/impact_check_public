"use strict";
/**
 * @module core/session/session-manager
 * @description 세션 관리자 - 분석 중간 결과 저장 및 세션 재개 지원
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
exports.SessionManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const file_1 = require("../../utils/file");
const logger_1 = require("../../utils/logger");
/**
 * SessionManager - 분석 세션 관리
 *
 * .impact/session/ 디렉토리에 세션 상태를 저장하고
 * --resume 플래그로 이전 세션을 재개할 수 있습니다.
 */
class SessionManager {
    constructor(basePath) {
        this.basePath = basePath;
    }
    /**
     * 세션 디렉토리 경로
     */
    getSessionDir() {
        return path.join((0, file_1.getImpactDir)(this.basePath), 'session');
    }
    /**
     * 부분 결과 파일 경로
     */
    getPartialResultPath() {
        return path.join(this.getSessionDir(), 'partial-result.json');
    }
    /**
     * 재개 정보 파일 경로
     */
    getPendingResumePath() {
        return path.join(this.getSessionDir(), 'pending-resume.json');
    }
    /**
     * 새 세션 시작
     * @param projectId - 프로젝트 ID
     * @param specFilePath - 기획서 파일 경로 (선택)
     * @param specContent - 기획서 내용 (선택)
     * @returns 세션 상태
     */
    startSession(projectId, specFilePath, specContent) {
        const now = new Date().toISOString();
        const sessionId = `session-${Date.now()}`;
        const session = {
            sessionId,
            projectId,
            specFilePath,
            specContent,
            lastCompletedStep: 0,
            totalSteps: 6,
            startedAt: now,
            updatedAt: now,
        };
        this.saveSession(session);
        logger_1.logger.debug(`Session started: ${sessionId}`);
        return session;
    }
    /**
     * 세션 진행 상황 업데이트
     * @param session - 현재 세션 상태
     * @param completedStep - 완료된 단계 번호
     * @param partialResult - 부분 결과 (선택)
     */
    updateProgress(session, completedStep, partialResult) {
        session.lastCompletedStep = completedStep;
        session.updatedAt = new Date().toISOString();
        if (partialResult) {
            session.partialResult = partialResult;
            // 부분 결과를 별도 파일로도 저장
            this.savePartialResult(partialResult);
        }
        this.saveSession(session);
        logger_1.logger.debug(`Session progress: step ${completedStep}/${session.totalSteps}`);
    }
    /**
     * 세션 실패 기록
     * @param session - 세션 상태
     * @param errorMessage - 오류 메시지
     */
    recordFailure(session, errorMessage) {
        session.errorMessage = errorMessage;
        session.updatedAt = new Date().toISOString();
        this.saveSession(session);
        logger_1.logger.debug(`Session failure recorded: ${errorMessage}`);
    }
    /**
     * 세션 완료 처리 (세션 파일 삭제)
     */
    completeSession() {
        const resumePath = this.getPendingResumePath();
        const partialPath = this.getPartialResultPath();
        if (fs.existsSync(resumePath)) {
            fs.unlinkSync(resumePath);
        }
        if (fs.existsSync(partialPath)) {
            fs.unlinkSync(partialPath);
        }
        logger_1.logger.debug('Session completed and cleaned up');
    }
    /**
     * 재개 가능한 세션이 있는지 확인
     * @returns 재개 정보
     */
    checkPendingResume() {
        const resumePath = this.getPendingResumePath();
        if (!fs.existsSync(resumePath)) {
            return null;
        }
        const session = (0, file_1.readJsonFile)(resumePath);
        if (!session) {
            return null;
        }
        // 세션 유효성 검사: 24시간 이상 경과 시 만료
        const sessionAge = Date.now() - new Date(session.updatedAt).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (sessionAge > maxAge) {
            return {
                session,
                canResume: false,
                reason: '세션이 24시간 이상 경과하여 만료되었습니다.',
            };
        }
        // 부분 결과 확인
        if (session.lastCompletedStep === 0) {
            return {
                session,
                canResume: false,
                reason: '진행된 분석이 없습니다. 새로 분석을 시작하세요.',
            };
        }
        return {
            session,
            canResume: true,
        };
    }
    /**
     * 부분 결과 로드
     * @returns 부분 결과 또는 null
     */
    loadPartialResult() {
        const partialPath = this.getPartialResultPath();
        if (!fs.existsSync(partialPath)) {
            return null;
        }
        return (0, file_1.readJsonFile)(partialPath);
    }
    /**
     * 세션 상태 저장
     */
    saveSession(session) {
        const sessionDir = this.getSessionDir();
        (0, file_1.ensureDir)(sessionDir);
        (0, file_1.writeJsonFile)(this.getPendingResumePath(), session);
    }
    /**
     * 부분 결과 저장
     */
    savePartialResult(result) {
        const sessionDir = this.getSessionDir();
        (0, file_1.ensureDir)(sessionDir);
        (0, file_1.writeJsonFile)(this.getPartialResultPath(), result);
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=session-manager.js.map