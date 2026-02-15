/**
 * @module utils/file
 * @description 파일 시스템 유틸리티 - 파일/디렉토리 관련 헬퍼 함수
 */
/**
 * 디렉토리가 존재하는지 확인하고, 없으면 생성
 * @param dirPath - 디렉토리 경로
 */
export declare function ensureDir(dirPath: string): void;
/**
 * 파일이 존재하는지 확인
 * @param filePath - 파일 경로
 * @returns 존재 여부
 */
export declare function fileExists(filePath: string): boolean;
/**
 * JSON 파일을 읽고 파싱
 * @param filePath - JSON 파일 경로
 * @returns 파싱된 객체, 파일이 없으면 null
 */
export declare function readJsonFile<T>(filePath: string): T | null;
/**
 * 객체를 JSON 파일로 저장
 * @param filePath - 저장할 파일 경로
 * @param data - 저장할 데이터
 */
export declare function writeJsonFile<T>(filePath: string, data: T): void;
/**
 * 파일의 SHA-256 해시를 계산
 * @param filePath - 파일 경로
 * @returns SHA-256 해시 문자열
 */
export declare function calculateFileHash(filePath: string): string;
/**
 * .impact 디렉토리의 기본 경로를 반환
 * @param basePath - 기본 경로 (기본값: HOME 디렉토리)
 * @returns .impact 디렉토리 절대 경로
 */
export declare function getImpactDir(basePath?: string): string;
/**
 * 프로젝트별 디렉토리 경로를 반환
 * @param projectId - 프로젝트 ID
 * @param basePath - 기본 경로
 * @returns 프로젝트 디렉토리 경로
 */
export declare function getProjectDir(projectId: string, basePath?: string): string;
/**
 * 문자열을 kebab-case로 변환
 * @param str - 변환할 문자열
 * @returns kebab-case 문자열
 */
export declare function toKebabCase(str: string): string;
/**
 * 파일 크기를 사람이 읽을 수 있는 형태로 변환
 * @param bytes - 바이트 크기
 * @returns 포맷팅된 크기 문자열
 */
export declare function formatFileSize(bytes: number): string;
//# sourceMappingURL=file.d.ts.map