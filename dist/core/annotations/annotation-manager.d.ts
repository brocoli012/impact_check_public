/**
 * @module core/annotations/annotation-manager
 * @description AnnotationManager - YAML 기반 보강 주석 CRUD, sourceHash 비교, userModified 병합
 */
import { AnnotationFile, AnnotationMeta } from '../../types/annotations';
/**
 * AnnotationManager - 보강 주석 파일의 CRUD 및 병합을 담당
 *
 * 기능:
 *   - YAML 파일로 보강 주석 저장/로드
 *   - sourceHash 비교를 통한 변경 감지
 *   - userModified 항목 보존 병합
 *   - 삭제된 함수의 보강 주석 정리
 *   - meta.json 통계 관리
 */
export declare class AnnotationManager {
    private readonly basePath;
    /**
     * @param basePath - 보강 주석 기본 저장 경로 (기본값: ~/.impact)
     */
    constructor(basePath?: string);
    /**
     * 보강 주석 파일을 YAML로 저장
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @param annotation - 보강 주석 데이터
     */
    save(projectId: string, filePath: string, annotation: AnnotationFile): Promise<void>;
    /**
     * 보강 주석 파일을 YAML에서 로드
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @returns 보강 주석 데이터 또는 null (파일 없을 시)
     */
    load(projectId: string, filePath: string): Promise<AnnotationFile | null>;
    /**
     * 특정 프로젝트의 모든 보강 주석을 로드
     * @param projectId - 프로젝트 ID
     * @returns 파일경로 -> AnnotationFile 맵
     */
    loadAll(projectId: string): Promise<Map<string, AnnotationFile>>;
    /**
     * sourceHash 비교 - 원본 파일 변경 여부 확인
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @param currentHash - 현재 파일의 SHA-256 해시
     * @returns 변경되었으면 true, 동일하면 false
     */
    isChanged(projectId: string, filePath: string, currentHash: string): Promise<boolean>;
    /**
     * userModified 보존 병합
     *
     * 병합 규칙:
     *   - updated의 annotations을 기본으로 사용
     *   - existing의 annotations 중 userModified: true인 항목은 보존
     *   - 동일 함수명의 userModified 항목은 existing 것을 유지
     *   - 새로운 함수는 updated에서 추가
     *
     * @param existing - 기존 보강 주석
     * @param updated - 새로 생성된 보강 주석
     * @returns 병합된 보강 주석
     */
    merge(existing: AnnotationFile, updated: AnnotationFile): Promise<AnnotationFile>;
    /**
     * 삭제된 함수의 보강 주석 정리
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @param currentFunctions - 현재 존재하는 함수명 목록
     */
    cleanup(projectId: string, filePath: string, currentFunctions: string[]): Promise<void>;
    /**
     * meta.json 통계 갱신
     * @param projectId - 프로젝트 ID
     * @returns 갱신된 메타 정보
     */
    updateMeta(projectId: string): Promise<AnnotationMeta>;
    /**
     * meta.json 읽기
     * @param projectId - 프로젝트 ID
     * @returns 메타 정보 또는 null
     */
    getMeta(projectId: string): Promise<AnnotationMeta | null>;
    /**
     * 보강 주석 파일 삭제
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     */
    delete(projectId: string, filePath: string): Promise<void>;
    /**
     * 디렉토리 존재 확인/생성
     * @param dirPath - 디렉토리 경로
     */
    private ensureDir;
    /**
     * 파일 경로를 보강 주석 파일 경로로 변환
     *
     * 규칙: {basePath}/annotations/{projectId}/{원본파일경로}.annotations.yaml
     * 예: ~/.impact/annotations/my-project/src/services/shipping.ts.annotations.yaml
     *
     * @param projectId - 프로젝트 ID
     * @param filePath - 원본 파일 경로
     * @returns 보강 주석 파일 절대 경로
     */
    private getAnnotationPath;
    /**
     * meta.json 파일 경로 반환
     * @param projectId - 프로젝트 ID
     * @returns meta.json 절대 경로
     */
    private getMetaPath;
    /**
     * 디렉토리 내의 모든 .annotations.yaml 파일을 재귀적으로 찾기
     * @param dir - 탐색할 디렉토리
     * @returns YAML 파일 경로 목록
     */
    private findYamlFiles;
}
//# sourceMappingURL=annotation-manager.d.ts.map