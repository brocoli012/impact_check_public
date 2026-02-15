/**
 * @module core/indexing/policy-extractor
 * @description 정책 추출기 - 코드 주석, 문서, YAML에서 정책 정보 추출
 */
import { PolicyInfo } from '../../types/index';
import { ParsedFile } from './types';
/**
 * PolicyExtractor - 코드 주석, 문서, YAML에서 정책 정보를 추출
 *
 * 기능:
 *   - 코드 주석에서 정책 추출 (// 정책:, /* Policy: * / 패턴)
 *   - README/POLICY.md 문서에서 정책 추출
 *   - policies.yaml에서 수동 정책 로드
 *   - 모든 소스 병합 및 중복 제거
 */
export declare class PolicyExtractor {
    /**
     * 코드 주석에서 정책 추출
     * @param parsedFiles - 파싱된 파일 목록
     * @returns 추출된 정책 목록
     */
    extractFromComments(parsedFiles: ParsedFile[]): PolicyInfo[];
    /**
     * README/POLICY.md에서 정책 추출
     * @param projectPath - 프로젝트 루트 경로
     * @returns 추출된 정책 목록
     */
    extractFromDocs(projectPath: string): Promise<PolicyInfo[]>;
    /**
     * policies.yaml에서 수동 정책 로드
     * @param projectPath - 프로젝트 루트 경로
     * @returns 로드된 정책 목록
     */
    loadManualPolicies(projectPath: string): Promise<PolicyInfo[]>;
    /**
     * 모든 소스의 정책 병합
     * @param sources - 정책 소스 배열
     * @returns 병합된 정책 목록
     */
    mergeAllPolicies(...sources: PolicyInfo[][]): PolicyInfo[];
    /**
     * 정책 주석 텍스트 정리
     */
    private cleanPolicyText;
    /**
     * 정책 이름 추출
     */
    private extractPolicyName;
    /**
     * 정책 카테고리 감지
     */
    private detectCategory;
    /**
     * 마크다운에서 정책 섹션 파싱
     */
    private parseMarkdownPolicySections;
}
//# sourceMappingURL=policy-extractor.d.ts.map