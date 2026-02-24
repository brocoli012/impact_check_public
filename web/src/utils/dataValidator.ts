/**
 * @module web/utils/dataValidator
 * @description API 응답의 AnalysisResult를 안전하게 정규화.
 * undefined/null 배열 필드를 빈 배열로 채움.
 * React #310 방지를 위해 문자열 배열 필드의 아이템이 object일 경우 문자열로 변환.
 */

import type { AnalysisResult } from '../types';

/**
 * 배열의 각 요소가 문자열인지 확인하고, object인 경우 문자열로 변환
 */
function ensureStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (typeof item === 'string') return item;
    if (item == null) return '';
    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if ('content' in obj && typeof obj.content === 'string') return obj.content;
      if ('keyword' in obj && typeof obj.keyword === 'string') return obj.keyword;
      if ('name' in obj && typeof obj.name === 'string') return obj.name;
      if ('label' in obj && typeof obj.label === 'string') return obj.label;
      try { return JSON.stringify(item); } catch { return '[object]'; }
    }
    return String(item);
  });
}

/**
 * API 응답의 AnalysisResult를 안전하게 정규화.
 * undefined/null 배열 필드를 빈 배열로 채움.
 */
export function sanitizeAnalysisResult(result: any): AnalysisResult {
  if (!result) return result;

  return {
    ...result,
    affectedScreens: (result.affectedScreens ?? []).map((s: any) => ({
      ...s,
      tasks: (s.tasks ?? []).map((t: any) => ({
        ...t,
        affectedFiles: ensureStringArray(t.affectedFiles),
        relatedApis: ensureStringArray(t.relatedApis),
        planningChecks: ensureStringArray(t.planningChecks),
      })),
    })),
    tasks: (result.tasks ?? []).map((t: any) => ({
      ...t,
      affectedFiles: ensureStringArray(t.affectedFiles),
      relatedApis: ensureStringArray(t.relatedApis),
      planningChecks: ensureStringArray(t.planningChecks),
      sourceRequirementIds: ensureStringArray(t.sourceRequirementIds),
      sourceFeatureIds: ensureStringArray(t.sourceFeatureIds),
    })),
    planningChecks: result.planningChecks ?? [],
    policyChanges: (result.policyChanges ?? []).map((pc: any) => ({
      ...pc,
      affectedFiles: ensureStringArray(pc.affectedFiles),
    })),
    screenScores: (result.screenScores ?? []).map((ss: any) => ({
      ...ss,
      taskScores: ss.taskScores ?? [],
    })),
    policyWarnings: (result.policyWarnings ?? []).map((pw: any) => ({
      ...pw,
      relatedTaskIds: ensureStringArray(pw.relatedTaskIds),
    })),
    ownerNotifications: (result.ownerNotifications ?? []).map((on: any) => ({
      ...on,
      relatedTaskIds: ensureStringArray(on.relatedTaskIds),
    })),
    confidenceScores: (result.confidenceScores ?? []).map((cs: any) => ({
      ...cs,
      warnings: ensureStringArray(cs.warnings),
      recommendations: ensureStringArray(cs.recommendations),
    })),
    lowConfidenceWarnings: result.lowConfidenceWarnings ?? [],
  };
}
