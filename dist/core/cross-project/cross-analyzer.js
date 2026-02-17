"use strict";
/**
 * @module core/cross-project/cross-analyzer
 * @description 크로스 프로젝트 영향도 분석기 - 프로젝트 간 API 변경 영향 분석
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
/**
 * CrossAnalyzer - 크로스 프로젝트 영향도 분석
 *
 * 소스 프로젝트의 API 변경이 연결된 프로젝트에 미치는 영향을 분석합니다.
 * 직접 연결된 프로젝트만 분석합니다 (depth=1).
 */
class CrossAnalyzer {
    constructor(manager, contractChecker) {
        this.manager = manager;
        this.contractChecker = contractChecker;
    }
    /**
     * 크로스 프로젝트 영향도 분석
     *
     * @param sourceProjectId - 소스 프로젝트 ID
     * @param indexer - 인덱서 인스턴스
     * @param options - 분석 옵션
     * @returns 크로스 프로젝트 영향도 분석 결과
     */
    async analyze(sourceProjectId, indexer, options) {
        logger_1.logger.info(`크로스 프로젝트 분석 시작: ${sourceProjectId}`);
        // 1. 연결된 프로젝트 조회
        let links = await this.manager.getLinks(sourceProjectId);
        if (links.length === 0) {
            logger_1.logger.info('연결된 프로젝트가 없습니다.');
            return { affectedProjects: [], apiContractChanges: [] };
        }
        // 2. groupName 필터 적용
        if (options?.groupName) {
            const group = await this.manager.getGroup(options.groupName);
            if (group) {
                const groupProjectIds = new Set(group.projects);
                // 소스 프로젝트가 아닌 쪽(대상 프로젝트)이 그룹에 포함되어야 함
                links = links.filter((l) => {
                    const otherProjectId = l.source === sourceProjectId ? l.target : l.source;
                    return groupProjectIds.has(otherProjectId);
                });
            }
            else {
                logger_1.logger.warn(`그룹을 찾을 수 없습니다: ${options.groupName}`);
                return { affectedProjects: [], apiContractChanges: [] };
            }
        }
        // 3. 소스 프로젝트 인덱스 로드
        const sourceIndex = await indexer.loadIndex(sourceProjectId);
        if (!sourceIndex) {
            logger_1.logger.warn(`소스 프로젝트 인덱스를 로드할 수 없습니다: ${sourceProjectId}`);
            return { affectedProjects: [], apiContractChanges: [] };
        }
        const sourceApis = sourceIndex.apis;
        // 4. 연결된 각 프로젝트에 대해 분석 (depth=1)
        const affectedProjects = [];
        const allContractChanges = [];
        // 대상 프로젝트 ID 추출 (소스가 아닌 쪽)
        const targetProjectIds = this.getTargetProjectIds(links, sourceProjectId);
        for (const targetId of targetProjectIds) {
            try {
                // 4a. 대상 프로젝트 인덱스 로드
                const targetIndex = await indexer.loadIndex(targetId);
                if (!targetIndex) {
                    logger_1.logger.debug(`대상 프로젝트 인덱스 로드 실패, 건너뜁니다: ${targetId}`);
                    continue;
                }
                const targetApis = targetIndex.apis;
                // 4b. API 계약 변경 감지
                const contractChanges = await this.contractChecker.checkContracts(sourceApis, targetApis, sourceApis);
                // Consumer 프로젝트 ID 주입
                for (const change of contractChanges) {
                    if (change.consumers.length > 0) {
                        change.consumers = [targetId];
                    }
                }
                // 4c. 영향을 받는 API 식별
                const affectedApiPaths = this.findAffectedApis(sourceApis, targetApis);
                // 4d. 영향 수준 계산
                const impactLevel = this.calculateImpactLevel(contractChanges, affectedApiPaths);
                // 4e. 영향을 받는 컴포넌트 수 계산
                const affectedComponents = this.countAffectedComponents(targetIndex, affectedApiPaths);
                // 4f. AffectedProject 구성
                if (affectedApiPaths.length > 0 || contractChanges.length > 0) {
                    const projectName = targetIndex.meta.project.name || targetId;
                    affectedProjects.push({
                        projectId: targetId,
                        projectName,
                        impactLevel,
                        affectedApis: affectedApiPaths,
                        affectedComponents,
                        summary: this.generateSummary(targetId, impactLevel, affectedApiPaths.length, contractChanges.length),
                    });
                }
                allContractChanges.push(...contractChanges);
            }
            catch (err) {
                logger_1.logger.debug(`프로젝트 분석 중 오류: ${targetId}: ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
        }
        logger_1.logger.info(`크로스 프로젝트 분석 완료: ${affectedProjects.length}개 프로젝트 영향`);
        return {
            affectedProjects,
            apiContractChanges: allContractChanges,
        };
    }
    /**
     * 링크에서 대상 프로젝트 ID 추출 (소스가 아닌 쪽, 중복 제거)
     */
    getTargetProjectIds(links, sourceProjectId) {
        const targetIds = new Set();
        for (const link of links) {
            if (link.source === sourceProjectId) {
                targetIds.add(link.target);
            }
            else if (link.target === sourceProjectId) {
                targetIds.add(link.source);
            }
        }
        return Array.from(targetIds);
    }
    /**
     * 소스 API와 대상 API 사이의 공통 API 경로 식별
     */
    findAffectedApis(sourceApis, targetApis) {
        const sourcePathSet = new Set(sourceApis.map((a) => a.path));
        const affected = [];
        for (const api of targetApis) {
            if (sourcePathSet.has(api.path)) {
                affected.push(api.path);
            }
        }
        return affected;
    }
    /**
     * 영향 수준 계산
     *
     * - critical: 삭제된 API를 consumer가 사용
     * - high: 비하위 호환 변경 (modify)
     * - medium: 하위 호환 변경 (add)
     * - low: 간접 영향 (공통 API가 있지만 변경 없음)
     */
    calculateImpactLevel(contractChanges, affectedApiPaths) {
        // critical 체크: 삭제된 API를 consumer가 사용
        const hasCritical = contractChanges.some((c) => c.changeType === 'remove' && c.consumers.length > 0);
        if (hasCritical)
            return 'critical';
        // high 체크: 비하위 호환 변경 (modify with warning+ severity)
        const hasHigh = contractChanges.some((c) => c.changeType === 'modify' || c.severity === 'warning');
        if (hasHigh)
            return 'high';
        // medium 체크: 하위 호환 변경 (add)
        const hasMedium = contractChanges.some((c) => c.changeType === 'add');
        if (hasMedium)
            return 'medium';
        // low: 간접 영향 (공통 API 존재)
        if (affectedApiPaths.length > 0)
            return 'low';
        return 'low';
    }
    /**
     * 영향을 받는 컴포넌트 수 계산
     */
    countAffectedComponents(targetIndex, affectedApiPaths) {
        if (affectedApiPaths.length === 0)
            return 0;
        const affectedPathSet = new Set(affectedApiPaths);
        let count = 0;
        for (const comp of targetIndex.components) {
            // 컴포넌트의 apiCalls에 영향받는 API가 포함되어 있으면 카운트
            const hasAffectedApi = comp.apiCalls.some((apiId) => affectedPathSet.has(apiId));
            if (hasAffectedApi) {
                count++;
            }
        }
        return count;
    }
    /**
     * 영향 요약 문자열 생성
     */
    generateSummary(targetId, impactLevel, affectedApiCount, contractChangeCount) {
        const parts = [];
        parts.push(`프로젝트 ${targetId}`);
        if (contractChangeCount > 0) {
            parts.push(`API 계약 변경 ${contractChangeCount}건`);
        }
        if (affectedApiCount > 0) {
            parts.push(`공유 API ${affectedApiCount}개`);
        }
        parts.push(`영향 수준: ${impactLevel}`);
        return parts.join(', ');
    }
}
exports.CrossAnalyzer = CrossAnalyzer;
//# sourceMappingURL=cross-analyzer.js.map