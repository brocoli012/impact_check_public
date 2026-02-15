/**
 * @module core/analysis/policy-matcher
 * @description 정책 매처 - 영향 받는 코드 근처 정책 매칭
 */
import { ImpactResult, PolicyWarning } from '../../types/analysis';
import { PolicyInfo } from '../../types/index';
/**
 * PolicyMatcher - 영향 받는 코드 근처 정책 매칭
 *
 * 영향 분석 결과의 affectedFiles와 정책 인덱스를 대조하여
 * 관련된 정책에 대한 경고를 생성.
 */
export declare class PolicyMatcher {
    /**
     * 영향 받는 코드 근처 정책 매칭
     * @param impact - 영향도 분석 결과
     * @param policies - 정책 목록
     * @returns 정책 경고 목록
     */
    match(impact: ImpactResult, policies: PolicyInfo[]): PolicyWarning[];
    /**
     * 컴포넌트가 작업과 관련이 있는지 확인
     */
    private isRelatedToTasks;
    /**
     * 모듈이 영향 받는 파일에 포함되는지 확인
     */
    private isModuleAffected;
    /**
     * 경고 심각도 결정
     */
    private determineSeverity;
    /**
     * 경고 메시지 생성
     */
    private buildWarningMessage;
}
//# sourceMappingURL=policy-matcher.d.ts.map