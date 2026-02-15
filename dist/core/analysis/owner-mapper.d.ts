/**
 * @module core/analysis/owner-mapper
 * @description 담당자 매퍼 - 영향 받는 시스템의 담당자 매핑
 */
import { ImpactResult, OwnerNotification } from '../../types/analysis';
import { OwnersConfig } from '../../types/config';
/**
 * OwnerMapper - 영향 받는 시스템의 담당자 매핑
 *
 * 영향 분석 결과의 affectedFiles와 담당자 설정(owners.json)을 대조하여
 * 각 시스템 담당자에게 알림을 생성.
 */
export declare class OwnerMapper {
    /**
     * 영향 받는 시스템의 담당자 매핑
     * @param impact - 영향도 분석 결과
     * @param owners - 담당자 설정
     * @returns 담당자 알림 목록
     */
    map(impact: ImpactResult, owners: OwnersConfig): OwnerNotification[];
    /**
     * 시스템의 관련 경로 중 영향 받는 파일과 매칭되는 경로 탐색
     */
    private findMatchingPaths;
    /**
     * 확인 요청 이메일 초안 생성
     */
    private generateEmailDraft;
}
//# sourceMappingURL=owner-mapper.d.ts.map