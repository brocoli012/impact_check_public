/**
 * @module web/utils/dataValidator
 * @description API 응답의 AnalysisResult를 안전하게 정규화.
 * undefined/null 배열 필드를 빈 배열로 채움.
 */

import type { AnalysisResult } from '../types';

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
        affectedFiles: t.affectedFiles ?? [],
        relatedApis: t.relatedApis ?? [],
        planningChecks: t.planningChecks ?? [],
      })),
    })),
    tasks: (result.tasks ?? []).map((t: any) => ({
      ...t,
      affectedFiles: t.affectedFiles ?? [],
      relatedApis: t.relatedApis ?? [],
      planningChecks: t.planningChecks ?? [],
      sourceRequirementIds: t.sourceRequirementIds ?? [],
      sourceFeatureIds: t.sourceFeatureIds ?? [],
    })),
    planningChecks: result.planningChecks ?? [],
    policyChanges: (result.policyChanges ?? []).map((pc: any) => ({
      ...pc,
      affectedFiles: pc.affectedFiles ?? [],
    })),
    screenScores: (result.screenScores ?? []).map((ss: any) => ({
      ...ss,
      taskScores: ss.taskScores ?? [],
    })),
    policyWarnings: (result.policyWarnings ?? []).map((pw: any) => ({
      ...pw,
      relatedTaskIds: pw.relatedTaskIds ?? [],
    })),
    ownerNotifications: (result.ownerNotifications ?? []).map((on: any) => ({
      ...on,
      relatedTaskIds: on.relatedTaskIds ?? [],
    })),
    confidenceScores: (result.confidenceScores ?? []).map((cs: any) => ({
      ...cs,
      warnings: cs.warnings ?? [],
      recommendations: cs.recommendations ?? [],
    })),
    lowConfidenceWarnings: result.lowConfidenceWarnings ?? [],
  };
}
