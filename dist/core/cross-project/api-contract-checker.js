"use strict";
/**
 * @module core/cross-project/api-contract-checker
 * @description API 계약 변경 검사기 - 프로젝트 간 API 호환성 검증
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiContractChecker = void 0;
const logger_1 = require("../../utils/logger");
/**
 * ApiContractChecker - 두 프로젝트 간 API 계약 변경을 검사
 *
 * 기능:
 *   - Provider API의 변경 감지 (추가, 삭제, 수정)
 *   - Consumer 영향도 분석
 *   - 심각도 분류 (info / warning / critical)
 */
class ApiContractChecker {
    /**
     * 두 프로젝트의 API 계약 비교
     *
     * previousProviderApis가 있으면 현재 provider API와 비교하여 변경 감지.
     * consumer API 목록을 참조하여 영향받는 프로젝트를 식별.
     *
     * @param providerApis - 현재 Provider의 API 목록
     * @param consumerApis - Consumer의 API 목록 (영향 받는 대상 식별용)
     * @param previousProviderApis - 이전 Provider의 API 목록 (변경 감지 기준)
     * @returns API 계약 변경 목록
     */
    async checkContracts(providerApis, consumerApis, previousProviderApis) {
        if (!previousProviderApis) {
            logger_1.logger.debug('이전 Provider API 없음, 변경 감지 불가');
            return [];
        }
        const changes = [];
        // Consumer가 사용하는 API 경로 Set
        const consumerPathSet = new Set(consumerApis.map(a => a.path));
        // 이전 API를 path 기준으로 Map 구축
        const previousApiMap = new Map();
        for (const api of previousProviderApis) {
            previousApiMap.set(api.path, api);
        }
        // 현재 API를 path 기준으로 Map 구축
        const currentApiMap = new Map();
        for (const api of providerApis) {
            currentApiMap.set(api.path, api);
        }
        // 1. 새로운 API 추가 감지
        for (const api of providerApis) {
            if (!previousApiMap.has(api.path)) {
                const consumers = consumerPathSet.has(api.path) ? ['consumer'] : [];
                const change = {
                    apiPath: api.path,
                    changeType: 'add',
                    consumers,
                    severity: 'info',
                };
                change.severity = this.classifySeverity(change);
                changes.push(change);
            }
        }
        // 2. API 삭제 감지
        for (const api of previousProviderApis) {
            if (!currentApiMap.has(api.path)) {
                const consumers = consumerPathSet.has(api.path) ? ['consumer'] : [];
                const change = {
                    apiPath: api.path,
                    changeType: 'remove',
                    consumers,
                    severity: 'info', // placeholder
                };
                change.severity = this.classifySeverity(change);
                changes.push(change);
            }
        }
        // 3. API 수정 감지 (method, handler, requestParams, responseType 변경)
        for (const api of providerApis) {
            const previous = previousApiMap.get(api.path);
            if (!previous)
                continue;
            const detectedChange = this.detectChange(api, previous);
            if (detectedChange) {
                detectedChange.consumers = consumerPathSet.has(api.path) ? ['consumer'] : [];
                detectedChange.severity = this.classifySeverity(detectedChange);
                changes.push(detectedChange);
            }
        }
        logger_1.logger.info(`API 계약 변경 감지: ${changes.length}건`);
        return changes;
    }
    /**
     * 단일 API 변경 감지
     *
     * 현재 API와 이전 API를 비교하여 변경 사항을 감지합니다.
     *
     * @param current - 현재 API 엔드포인트
     * @param previous - 이전 API 엔드포인트 (없으면 null 반환)
     * @returns API 계약 변경 또는 null (변경 없음)
     */
    detectChange(current, previous) {
        if (!previous)
            return null;
        // method, handler, requestParams, responseType 비교
        const hasMethodChange = current.method !== previous.method;
        const hasHandlerChange = current.handler !== previous.handler;
        const hasParamsChange = JSON.stringify(current.requestParams.sort()) !==
            JSON.stringify(previous.requestParams.sort());
        const hasResponseChange = current.responseType !== previous.responseType;
        if (hasMethodChange || hasHandlerChange || hasParamsChange || hasResponseChange) {
            return {
                apiPath: current.path,
                changeType: 'modify',
                consumers: [],
                severity: 'warning',
            };
        }
        return null;
    }
    /**
     * 심각도 분류
     *
     * - info: 하위 호환 변경 (API 추가)
     * - warning: 비하위 호환 변경 (API 수정)
     * - critical: API 삭제 (consumer가 있으면)
     *
     * @param change - API 계약 변경
     * @returns 심각도 레벨
     */
    classifySeverity(change) {
        switch (change.changeType) {
            case 'add':
                return 'info';
            case 'remove':
                return change.consumers.length > 0 ? 'critical' : 'warning';
            case 'modify':
                return 'warning';
            default:
                return 'info';
        }
    }
}
exports.ApiContractChecker = ApiContractChecker;
//# sourceMappingURL=api-contract-checker.js.map