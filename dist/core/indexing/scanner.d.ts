/**
 * @module core/indexing/scanner
 * @description 파일 스캐너 - 프로젝트 디렉토리를 스캔하여 파일 목록 생성
 */
import { ScanResult } from './types';
/**
 * FileScanner - 프로젝트 디렉토리를 스캔하여 파일 목록 생성
 *
 * 기능:
 *   - fast-glob을 사용한 파일 탐색
 *   - .gitignore 패턴 적용
 *   - 기술 스택 자동 감지
 *   - 파일별 SHA-256 해시 생성
 */
export declare class FileScanner {
    /**
     * 프로젝트 디렉토리를 스캔하여 파일 목록 생성
     * @param projectPath - 프로젝트 루트 경로
     * @returns 스캔 결과
     */
    scan(projectPath: string): Promise<ScanResult>;
    /**
     * .gitignore 패턴 로드 및 적용
     * @param projectPath - 프로젝트 루트 경로
     * @returns ignore 인스턴스
     */
    private loadIgnorePatterns;
    /**
     * 기술 스택 자동 감지
     * @param projectPath - 프로젝트 루트 경로
     * @returns 감지된 기술 스택 목록
     */
    private detectTechStack;
    /**
     * 파일의 SHA-256 해시 생성
     * @param filePath - 파일 절대 경로
     * @returns SHA-256 해시 문자열
     */
    private computeFileHash;
}
//# sourceMappingURL=scanner.d.ts.map