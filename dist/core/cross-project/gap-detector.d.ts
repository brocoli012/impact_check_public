/**
 * @module core/cross-project/gap-detector
 * @description 크로스 프로젝트 갭 탐지기 - 프로젝트 간 의존성/분석 상태 점검
 *
 * 4가지 탐지 유형:
 * 1. Stale 링크 (High): confirmedAt이 인덱스 meta.updatedAt보다 오래되었거나, 프로젝트 미존재
 * 2. 미분석 프로젝트 (Medium): cross-project.json links에 등장하지 않는 등록 프로젝트
 * 3. 저신뢰도 분석 (Medium): totalScore < 60인 분석 결과 (active 상태만)
 * 4. 인덱스 미갱신 (Low): git 커밋 시각 > 인덱스 meta.updatedAt
 */
import type { GapItem, GapCheckResult, FixResult } from './types';
/**
 * GapDetector - 크로스 프로젝트 갭 탐지기
 *
 * 등록된 프로젝트와 cross-project.json의 링크 상태를 점검하여
 * 관리가 필요한 갭(Gap)을 식별합니다.
 */
export declare class GapDetector {
    private readonly crossManager;
    private readonly resultManager;
    /** .impact 디렉토리 경로 (예: ~/.impact) */
    private readonly impactDir;
    /**
     * GapDetector 생성
     * @param basePath - HOME 경로 (기본값: process.env.HOME)
     *                   .impact 하위에 projects.json, cross-project.json 등이 위치
     */
    constructor(basePath?: string);
    /**
     * 갭 탐지 실행
     * @param options - 탐지 옵션 (projectId로 필터 가능)
     * @returns 갭 탐지 결과
     */
    detect(options?: {
        projectId?: string;
    }): Promise<GapCheckResult>;
    /**
     * 갭 자동 수정
     *
     * 수정 가능한 갭 유형:
     * - stale-link (프로젝트 삭제): cross-project.json에서 해당 링크 제거
     * - stale-link (오래된 confirmedAt): 안내 메시지 (detectAndSave 재실행 필요)
     * - unanalyzed-project: 안내 메시지 (cross-analyze --auto 실행 필요)
     * - stale-index: 안내 메시지 (reindex 실행 필요)
     * - low-confidence: fixable=false이므로 skip
     *
     * @param gaps - 수정할 갭 목록
     * @returns 수정 결과
     */
    fix(gaps: GapItem[]): Promise<FixResult>;
    /**
     * stale-link가 프로젝트 삭제로 인한 것인지 판별
     * (프로젝트가 등록되지 않은 경우)
     */
    private isDeletedProjectLink;
    /**
     * Stale 링크 탐지 (High)
     *
     * - confirmedAt이 인덱스 meta.updatedAt보다 오래된 링크
     * - 프로젝트가 삭제/미존재하는 링크
     */
    private detectStaleLinks;
    /**
     * 미분석 프로젝트 탐지 (Medium)
     *
     * cross-project.json links에 한 번도 등장하지 않는 등록 프로젝트
     */
    private detectUnanalyzedProjects;
    /**
     * 저신뢰도 분석 탐지 (Medium)
     *
     * totalScore < 60인 분석 결과 (active 상태만 대상)
     * completed, on-hold, archived 상태는 제외
     */
    private detectLowConfidence;
    /**
     * 인덱스 미갱신 탐지 (Low)
     *
     * git log -1 --format=%ci 날짜 > 인덱스 meta.updatedAt
     */
    private detectStaleIndex;
    /**
     * 등록 프로젝트 목록 로드
     */
    private loadProjects;
    /**
     * 프로젝트 인덱스의 meta.updatedAt 조회
     */
    private getIndexUpdatedAt;
    /**
     * 프로젝트의 마지막 git 커밋 날짜 조회
     * @param projectPath - 프로젝트 Git 레포 경로
     * @returns ISO 형식 날짜 문자열 또는 null
     */
    private getLastGitCommitDate;
    /**
     * 빈 결과 생성 (프로젝트가 0개이거나 cross-project.json이 없을 때)
     */
    private emptyResult;
}
//# sourceMappingURL=gap-detector.d.ts.map