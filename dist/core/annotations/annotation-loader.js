"use strict";
/**
 * @module core/annotations/annotation-loader
 * @description AnnotationLoader - 분석 파이프라인에서 보강 주석을 로드하는 도우미 클래스
 *
 * AnnotationManager를 래핑하여 프로젝트/파일 단위 보강 주석 로드와
 * Layer 3 신뢰도 보너스 점수 계산 기능을 제공한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationLoader = void 0;
const annotation_manager_1 = require("./annotation-manager");
/**
 * AnnotationLoader - 보강 주석 로드 도우미
 *
 * 기능:
 *   - 프로젝트 전체/단일 파일/파일 목록 보강 주석 로드
 *   - Layer 3 신뢰도 보너스 점수 계산 (TASK-015에서 활용)
 *   - 프로젝트 메타 정보 조회
 */
class AnnotationLoader {
    /**
     * @param basePath - 보강 주석 기본 저장 경로 (기본값: ~/.impact)
     */
    constructor(basePath) {
        this.manager = new annotation_manager_1.AnnotationManager(basePath);
    }
    /**
     * 프로젝트의 모든 보강 주석 로드
     * @param projectId - 프로젝트 ID
     * @returns 파일경로 -> AnnotationFile 맵
     */
    async loadForProject(projectId) {
        return this.manager.loadAll(projectId);
    }
    /**
     * 특정 파일의 보강 주석 로드
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @returns 보강 주석 데이터 또는 null (파일 없을 시)
     */
    async loadForFile(projectId, filePath) {
        return this.manager.load(projectId, filePath);
    }
    /**
     * 특정 파일 목록에 대한 보강 주석만 로드 (필터링)
     * @param projectId - 프로젝트 ID
     * @param filePaths - 대상 파일 경로 목록
     * @returns 파일경로 -> AnnotationFile 맵 (해당 파일만)
     */
    async loadForFiles(projectId, filePaths) {
        const result = new Map();
        for (const filePath of filePaths) {
            const annotation = await this.manager.load(projectId, filePath);
            if (annotation) {
                result.set(filePath, annotation);
            }
        }
        return result;
    }
    /**
     * Layer 3 신뢰도 보너스 점수 계산
     *
     * 보강 주석의 품질/양에 따라 추가 신뢰도 점수를 계산한다.
     * TASK-015의 ConfidenceScorer에서 Layer 3 보너스로 활용된다.
     *
     * 계산 규칙:
     *   - 보강 주석 존재: +15점
     *   - 평균 confidence >= 0.7: +10점
     *   - 총 policies 5건 이상: +10점
     *   - userModified 항목 존재: +5점
     *   - 최대 40점
     *
     * @param annotations - 파일경로 -> AnnotationFile 맵
     * @returns 보너스 점수 (0~40)
     */
    calculateConfidenceBonus(annotations) {
        if (annotations.size === 0) {
            return 0;
        }
        let bonus = 0;
        // 보강 주석 존재: +15점
        bonus += 15;
        // 평균 confidence 계산
        let totalConfidence = 0;
        let confidenceCount = 0;
        let totalPolicies = 0;
        let hasUserModified = false;
        for (const [, annotationFile] of annotations) {
            for (const ann of annotationFile.annotations) {
                totalConfidence += ann.confidence;
                confidenceCount += 1;
                const policyCount = ann.policies ? ann.policies.length : 0;
                totalPolicies += policyCount;
                if (ann.userModified) {
                    hasUserModified = true;
                }
            }
        }
        // 평균 confidence >= 0.7: +10점
        if (confidenceCount > 0) {
            const avgConfidence = totalConfidence / confidenceCount;
            if (avgConfidence >= 0.7) {
                bonus += 10;
            }
        }
        // 총 policies 5건 이상: +10점
        if (totalPolicies >= 5) {
            bonus += 10;
        }
        // userModified 항목 존재: +5점
        if (hasUserModified) {
            bonus += 5;
        }
        return Math.min(bonus, 40);
    }
    /**
     * 프로젝트 메타 정보 조회
     * @param projectId - 프로젝트 ID
     * @returns 메타 정보 또는 null
     */
    async getProjectMeta(projectId) {
        return this.manager.getMeta(projectId);
    }
}
exports.AnnotationLoader = AnnotationLoader;
//# sourceMappingURL=annotation-loader.js.map