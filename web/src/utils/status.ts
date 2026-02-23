/**
 * @module web/utils/status
 * @description 분석 결과 상태 유틸리티 (REQ-015-S)
 * Single Source of Truth for status transitions, labels, and styles on the frontend.
 */

import type { AnalysisStatus } from '../types';

/** 유효 상태 조회 (Lazy Migration 지원) */
export function getEffectiveStatus(status?: AnalysisStatus): AnalysisStatus {
  return status ?? 'active';
}

/** 유효한 전환 규칙 */
export const VALID_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  'active':    ['completed', 'on-hold', 'archived'],
  'completed': ['archived'],
  'on-hold':   ['active', 'archived'],
  'archived':  [],
};

/** 전환 가능 여부 판단 */
export function isValidTransition(
  from: AnalysisStatus,
  to: AnalysisStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/** 상태 한국어 라벨 */
export const STATUS_LABELS: Record<AnalysisStatus, string> = {
  'active':    '진행중',
  'completed': '완료',
  'on-hold':   '보류',
  'archived':  '폐기됨',
};

/** 상태 전환 액션 라벨 (드롭다운 메뉴에 표시) */
export const STATUS_ACTION_LABELS: Record<AnalysisStatus, string> = {
  'active':    '재개',
  'completed': '완료 처리',
  'on-hold':   '보류 처리',
  'archived':  '폐기',
};

/** 상태별 배지 색상 (StatusBadge에서 사용) */
export const STATUS_BADGE_STYLES: Record<AnalysisStatus, {
  bg: string; text: string; border: string;
}> = {
  'active':    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'completed': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  'on-hold':   { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  'archived':  { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
};

/** ResultCard border-l 색상 */
export const STATUS_CARD_STYLES: Record<AnalysisStatus, {
  borderColor: string; opacity: string; titleClass: string;
}> = {
  'active':    { borderColor: 'border-transparent', opacity: '', titleClass: '' },
  'completed': { borderColor: 'border-gray-300', opacity: 'opacity-70', titleClass: '' },
  'on-hold':   { borderColor: 'border-amber-400', opacity: 'opacity-85', titleClass: '' },
  'archived':  { borderColor: 'border-gray-200', opacity: 'opacity-50',
                 titleClass: 'line-through text-gray-400' },
};
