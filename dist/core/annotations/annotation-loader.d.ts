/**
 * @module core/annotations/annotation-loader
 * @description AnnotationLoader - 분석 파이프라인에서 보강 주석을 로드하는 도우미 클래스
 *
 * AnnotationManager를 래핑하여 프로젝트/파일 단위 보강 주석 로드와
 * Layer 3 신뢰도 보너스 점수 계산 기능을 제공한다.
 */
import { AnnotationFile, AnnotationMeta } from '../../types/annotations';
/**
 * AnnotationLoader - 보강 주석 로드 도우미
 *
 * 기능:
 *   - 프로젝트 전체/단일 파일/파일 목록 보강 주석 로드
 *   - Layer 3 신뢰도 보너스 점수 계산 (TASK-015에서 활용)
 *   - 프로젝트 메타 정보 조회
 */
export declare class AnnotationLoader {
    private readonly manager;
    /**
     * @param basePath - 보강 주석 기본 저장 경로 (기본값: ~/.impact)
     */
    constructor(basePath?: string);
    /**
     * 프로젝트의 모든 보강 주석 로드
     * @param projectId - 프로젝트 ID
     * @returns 파일경로 -> AnnotationFile 맵
     */
    loadForProject(projectId: string): Promise<Map<string, AnnotationFile>>;
    /**
     * 특정 파일의 보강 주석 로드
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @returns 보강 주석 데이터 또는 null (파일 없을 시)
     */
    loadForFile(projectId: string, filePath: string): Promise<AnnotationFile | null>;
    /**
     * 특정 파일 목록에 대한 보강 주석만 로드 (필터링)
     * @param projectId - 프로젝트 ID
     * @param filePaths - 대상 파일 경로 목록
     * @returns 파일경로 -> AnnotationFile 맵 (해당 파일만)
     */
    loadForFiles(projectId: string, filePaths: string[]): Promise<Map<string, AnnotationFile>>;
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
    calculateConfidenceBonus(annotations: Map<string, AnnotationFile>): number;
    /**
     * 프로젝트 메타 정보 조회
     * @param projectId - 프로젝트 ID
     * @returns 메타 정보 또는 null
     */
    getProjectMeta(projectId: string): Promise<AnnotationMeta | null>;
}
//# sourceMappingURL=annotation-loader.d.ts.map