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
export function ensureStringArray(arr: unknown): string[] {
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
 * policyWarnings 배열 요소를 안전하게 PolicyWarning 객체로 변환.
 * - string인 경우: { id, message, policyName, severity, policyId, relatedTaskIds } 자동 생성
 * - object인 경우: 필수 필드 보정 (message/policyName/severity 누락 시 기본값)
 * - 그 외: 건너뜀
 */
function sanitizePolicyWarning(pw: any, idx: number): any {
  if (typeof pw === 'string') {
    return {
      id: `pw-auto-${idx}`,
      policyId: `policy-auto-${idx}`,
      policyName: pw,
      message: pw,
      severity: 'info',
      relatedTaskIds: [],
    };
  }
  if (pw != null && typeof pw === 'object') {
    return {
      ...pw,
      id: pw.id ?? pw.policyId ?? `pw-auto-${idx}`,
      policyId: pw.policyId ?? pw.id ?? `policy-auto-${idx}`,
      policyName: typeof pw.policyName === 'string' ? pw.policyName : (typeof pw.message === 'string' ? pw.message : String(pw.policyName ?? pw.message ?? '')),
      message: typeof pw.message === 'string' ? pw.message : (typeof pw.policyName === 'string' ? pw.policyName : String(pw.message ?? pw.policyName ?? '')),
      severity: typeof pw.severity === 'string' ? pw.severity : 'info',
      relatedTaskIds: ensureStringArray(pw.relatedTaskIds),
    };
  }
  return null;
}

/**
 * policyChanges 배열 요소를 안전하게 PolicyChange 객체로 변환.
 * 다양한 스키마를 표준 형식으로 보정 (id/policyId, policyName/title 등)
 */
function sanitizePolicyChange(pc: any, idx: number): any {
  if (pc == null || typeof pc !== 'object') return null;
  return {
    ...pc,
    id: pc.id ?? pc.policyId ?? `pc-auto-${idx}`,
    policyName: typeof pc.policyName === 'string' ? pc.policyName : (typeof pc.title === 'string' ? pc.title : (typeof pc.description === 'string' ? pc.description : '')),
    description: typeof pc.description === 'string' ? pc.description : '',
    changeType: typeof pc.changeType === 'string' ? pc.changeType : 'modify',
    affectedFiles: ensureStringArray(pc.affectedFiles),
    requiresReview: typeof pc.requiresReview === 'boolean' ? pc.requiresReview : false,
  };
}

/**
 * planningChecks(top-level) 배열 요소를 안전하게 Check 객체로 변환.
 * 다양한 AI 분석 결과 스키마를 표준 형식으로 보정
 */
function sanitizePlanningCheck(c: any, idx: number): any {
  if (typeof c === 'string') {
    return {
      id: `check-auto-${idx}`,
      content: c,
      relatedFeatureId: '',
      priority: 'medium',
      status: 'pending',
    };
  }
  if (c != null && typeof c === 'object') {
    return {
      ...c,
      id: c.id ?? c.checkId ?? `check-auto-${idx}`,
      content: typeof c.content === 'string' ? c.content : (typeof c.description === 'string' ? c.description : (typeof c.title === 'string' ? c.title : JSON.stringify(c))),
      relatedFeatureId: typeof c.relatedFeatureId === 'string' ? c.relatedFeatureId : '',
      priority: typeof c.priority === 'string' ? c.priority.toLowerCase() : 'medium',
      status: typeof c.status === 'string' ? c.status.toLowerCase() : 'pending',
    };
  }
  return null;
}

/**
 * API 응답의 AnalysisResult를 안전하게 정규화.
 * undefined/null 배열 필드를 빈 배열로 채움.
 * 다양한 AI 분석 결과 스키마의 데이터를 표준 형식으로 보정.
 */
export function sanitizeAnalysisResult(result: any): AnalysisResult {
  if (!result) return result;

  return {
    ...result,
    // 문자열 필드 안전 보장
    specTitle: typeof result.specTitle === 'string' ? result.specTitle : String(result.specTitle ?? ''),
    recommendation: typeof result.recommendation === 'string' ? result.recommendation : String(result.recommendation ?? ''),
    affectedScreens: (result.affectedScreens ?? []).map((s: any) => ({
      ...s,
      screenId: typeof s.screenId === 'string' ? s.screenId : String(s.screenId ?? ''),
      screenName: typeof s.screenName === 'string' ? s.screenName : String(s.screenName ?? ''),
      tasks: (s.tasks ?? []).map((t: any) => ({
        ...t,
        title: typeof t.title === 'string' ? t.title : String(t.title ?? ''),
        description: typeof t.description === 'string' ? t.description : String(t.description ?? ''),
        rationale: typeof t.rationale === 'string' ? t.rationale : String(t.rationale ?? ''),
        affectedFiles: ensureStringArray(t.affectedFiles),
        relatedApis: ensureStringArray(t.relatedApis),
        planningChecks: ensureStringArray(t.planningChecks),
        sourceRequirementIds: ensureStringArray(t.sourceRequirementIds),
        sourceFeatureIds: ensureStringArray(t.sourceFeatureIds),
      })),
    })),
    tasks: (result.tasks ?? []).map((t: any) => ({
      ...t,
      title: typeof t.title === 'string' ? t.title : String(t.title ?? ''),
      description: typeof t.description === 'string' ? t.description : String(t.description ?? ''),
      rationale: typeof t.rationale === 'string' ? t.rationale : String(t.rationale ?? ''),
      affectedFiles: ensureStringArray(t.affectedFiles),
      relatedApis: ensureStringArray(t.relatedApis),
      planningChecks: ensureStringArray(t.planningChecks),
      sourceRequirementIds: ensureStringArray(t.sourceRequirementIds),
      sourceFeatureIds: ensureStringArray(t.sourceFeatureIds),
    })),
    planningChecks: (result.planningChecks ?? []).map(sanitizePlanningCheck).filter(Boolean),
    policyChanges: (result.policyChanges ?? []).map(sanitizePolicyChange).filter(Boolean),
    screenScores: (result.screenScores ?? []).map((ss: any) => ({
      ...ss,
      screenName: typeof ss.screenName === 'string' ? ss.screenName : String(ss.screenName ?? ''),
      taskScores: ss.taskScores ?? [],
    })),
    policyWarnings: (result.policyWarnings ?? []).map(sanitizePolicyWarning).filter(Boolean),
    ownerNotifications: (result.ownerNotifications ?? []).map((on: any) => ({
      ...on,
      systemName: typeof on.systemName === 'string' ? on.systemName : String(on.systemName ?? ''),
      relatedTaskIds: ensureStringArray(on.relatedTaskIds),
    })),
    confidenceScores: (result.confidenceScores ?? []).map((cs: any) => ({
      ...cs,
      systemName: typeof cs.systemName === 'string' ? cs.systemName : String(cs.systemName ?? ''),
      warnings: ensureStringArray(cs.warnings),
      recommendations: ensureStringArray(cs.recommendations),
    })),
    lowConfidenceWarnings: result.lowConfidenceWarnings ?? [],
  };
}
