/**
 * @module core/annotations/policy-converter
 * @description InferredPolicy -> PolicyInfo 변환 및 중복 제거 유틸리티
 *
 * 어노테이션(보강 주석)에서 추론된 정책을 인덱스의 PolicyInfo 형식으로 변환하고,
 * 인덱스 정책과 병합할 때 중복을 제거합니다.
 */

import { AnnotationFile } from '../../types/annotations';
import { PolicyInfo } from '../../types';

/** 변환 시 자동 생성되는 ID 접두사 */
const ANNOTATION_POLICY_PREFIX = 'ann_policy_';

/**
 * AnnotationFile 맵에서 모든 InferredPolicy를 추출하여 PolicyInfo로 변환
 *
 * @param annotations - 파일경로 -> AnnotationFile 맵
 * @returns PolicyInfo 배열 (source: 'annotation')
 */
export function convertAnnotationsToPolicies(
  annotations: Map<string, AnnotationFile>,
): PolicyInfo[] {
  const results: PolicyInfo[] = [];
  let idCounter = 0;

  for (const [, annotationFile] of annotations) {
    for (const funcAnnotation of annotationFile.annotations) {
      for (const inferredPolicy of funcAnnotation.policies) {
        results.push({
          id: `${ANNOTATION_POLICY_PREFIX}${idCounter++}`,
          name: inferredPolicy.name,
          description: inferredPolicy.description,
          source: 'annotation',
          sourceText: inferredPolicy.inferred_from || '',
          filePath: annotationFile.file,
          lineNumber: funcAnnotation.line,
          category: inferredPolicy.category || '기타',
          relatedComponents: [],
          relatedApis: funcAnnotation.relatedApis || [],
          relatedModules: [],
          extractedAt: annotationFile.lastAnalyzed || new Date().toISOString(),
          confidence: inferredPolicy.confidence,
        });
      }
    }
  }

  return results;
}

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
export function mergePolicies(
  indexPolicies: PolicyInfo[],
  annotationPolicies: PolicyInfo[],
): PolicyInfo[] {
  // 인덱스 정책의 (filePath, normalizedName) 셋 구축
  const indexKeys = new Set<string>();
  for (const p of indexPolicies) {
    indexKeys.add(makePolicyKey(p.filePath, p.name));
  }

  // 어노테이션 정책 중 인덱스에 중복되지 않는 것만 추가
  const uniqueAnnotations = annotationPolicies.filter((ap) => {
    const key = makePolicyKey(ap.filePath, ap.name);
    if (indexKeys.has(key)) {
      return false; // 정확히 일치 → 중복
    }

    // 유사도 체크: 인덱스 정책 중 같은 filePath인 것과 이름 유사도 비교
    for (const ip of indexPolicies) {
      if (ip.filePath === ap.filePath && isNameSimilar(ip.name, ap.name)) {
        return false; // 유사 → 중복
      }
    }

    return true;
  });

  return [...indexPolicies, ...uniqueAnnotations];
}

/**
 * 정책 키 생성 (filePath + 정규화된 name)
 */
function makePolicyKey(filePath: string, name: string): string {
  return `${filePath}::${normalizeName(name)}`;
}

/**
 * 이름 정규화: 소문자화, 공백/특수문자 제거
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_\-/,.:;()[\]{}'"]/g, '')
    .trim();
}

/**
 * 두 이름이 유사한지 판단
 * - 정규화 후 일치
 * - 한쪽이 다른쪽을 포함 (최소 길이 4자 이상)
 */
function isNameSimilar(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return true;

  // 포함 관계 (최소 4자 이상일 때만)
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }

  return false;
}
