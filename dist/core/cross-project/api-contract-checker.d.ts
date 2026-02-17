/**
 * @module core/cross-project/api-contract-checker
 * @description API 계약 변경 검사기 - 프로젝트 간 API 호환성 검증
 */
import { ApiEndpoint } from '../../types/index';
import { ApiContractChange } from './types';
/**
 * ApiContractChecker - 두 프로젝트 간 API 계약 변경을 검사
 *
 * 기능:
 *   - Provider API의 변경 감지 (추가, 삭제, 수정)
 *   - Consumer 영향도 분석
 *   - 심각도 분류 (info / warning / critical)
 */
export declare class ApiContractChecker {
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
    checkContracts(providerApis: ApiEndpoint[], consumerApis: ApiEndpoint[], previousProviderApis?: ApiEndpoint[]): Promise<ApiContractChange[]>;
    /**
     * 단일 API 변경 감지
     *
     * 현재 API와 이전 API를 비교하여 변경 사항을 감지합니다.
     *
     * @param current - 현재 API 엔드포인트
     * @param previous - 이전 API 엔드포인트 (없으면 null 반환)
     * @returns API 계약 변경 또는 null (변경 없음)
     */
    private detectChange;
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
    classifySeverity(change: ApiContractChange): 'info' | 'warning' | 'critical';
}
//# sourceMappingURL=api-contract-checker.d.ts.map