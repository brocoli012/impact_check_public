/**
 * @module core/cross-project/cross-analyzer
 * @description 크로스 프로젝트 영향도 분석기 - 프로젝트 간 API 변경 영향 분석
 */
import { CrossProjectManager } from './cross-project-manager';
import { ApiContractChecker } from './api-contract-checker';
import { CrossProjectImpact } from './types';
import { Indexer } from '../indexing/indexer';
/**
 * CrossAnalyzer - 크로스 프로젝트 영향도 분석
 *
 * 소스 프로젝트의 API 변경이 연결된 프로젝트에 미치는 영향을 분석합니다.
 * 직접 연결된 프로젝트만 분석합니다 (depth=1).
 */
export declare class CrossAnalyzer {
    private manager;
    private contractChecker;
    constructor(manager: CrossProjectManager, contractChecker: ApiContractChecker);
    /**
     * 크로스 프로젝트 영향도 분석
     *
     * @param sourceProjectId - 소스 프로젝트 ID
     * @param indexer - 인덱서 인스턴스
     * @param options - 분석 옵션
     * @returns 크로스 프로젝트 영향도 분석 결과
     */
    analyze(sourceProjectId: string, indexer: Indexer, options?: {
        groupName?: string;
    }): Promise<CrossProjectImpact>;
    /**
     * 링크에서 대상 프로젝트 ID 추출 (소스가 아닌 쪽, 중복 제거)
     */
    private getTargetProjectIds;
    /**
     * 소스 API와 대상 API 사이의 공통 API 경로 식별
     */
    private findAffectedApis;
    /**
     * 영향 수준 계산
     *
     * - critical: 삭제된 API를 consumer가 사용
     * - high: 비하위 호환 변경 (modify)
     * - medium: 하위 호환 변경 (add)
     * - low: 간접 영향 (공통 API가 있지만 변경 없음)
     */
    private calculateImpactLevel;
    /**
     * 영향을 받는 컴포넌트 수 계산
     */
    private countAffectedComponents;
    /**
     * 영향 요약 문자열 생성
     */
    private generateSummary;
}
//# sourceMappingURL=cross-analyzer.d.ts.map