/**
 * @module core/annotations/policy-converter
 * @description InferredPolicy -> PolicyInfo 변환 및 중복 제거 유틸리티
 *
 * 어노테이션(보강 주석)에서 추론된 정책을 인덱스의 PolicyInfo 형식으로 변환하고,
 * 인덱스 정책과 병합할 때 중복을 제거합니다.
 */
import { AnnotationFile } from '../../types/annotations';
import { PolicyInfo } from '../../types';
/**
 * AnnotationFile 맵에서 모든 InferredPolicy를 추출하여 PolicyInfo로 변환
 *
 * @param annotations - 파일경로 -> AnnotationFile 맵
 * @returns PolicyInfo 배열 (source: 'annotation')
 */
export declare function convertAnnotationsToPolicies(annotations: Map<string, AnnotationFile>): PolicyInfo[];
/**
 * 인덱스 정책과 어노테이션 정책을 병합하고 중복을 제거
 *
 * 중복 판정 기준:
 *   - 같은 filePath + 유사한 name (정규화 후 비교)
 *   - 유사도: 정규화된 이름이 정확히 일치하거나, 한쪽이 다른쪽을 포함
 *
 * 중복 시: 인덱스(comment/readme/manual) 정책을 우선 유지 (더 정확한 출처)
 *
 * @param indexPolicies - 인덱스에서 추출된 정책
 * @param annotationPolicies - 어노테이션에서 변환된 정책
 * @returns 병합 + 중복 제거된 정책 배열
 */
export declare function mergePolicies(indexPolicies: PolicyInfo[], annotationPolicies: PolicyInfo[]): PolicyInfo[];
//# sourceMappingURL=policy-converter.d.ts.map