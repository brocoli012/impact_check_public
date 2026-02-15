/**
 * @module web/utils/colors
 * @description 색상 시스템 - 등급별, 신뢰도별 색상 정의
 */

import type { Grade, ConfidenceGrade } from '../types';

/** 등급별 색상 */
export interface GradeColorSet {
  bg: string;
  border: string;
  text: string;
  bar: string;
}

/** 등급 색상 맵 */
export const GRADE_COLORS: Record<Grade, GradeColorSet> = {
  Low: { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', bar: '#22C55E' },
  Medium: { bg: '#FEFCE8', border: '#EAB308', text: '#A16207', bar: '#EAB308' },
  High: { bg: '#FFF7ED', border: '#F97316', text: '#C2410C', bar: '#F97316' },
  Critical: { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C', bar: '#EF4444' },
};

/** 신뢰도 색상 맵 */
export const CONFIDENCE_COLORS: Record<ConfidenceGrade, string> = {
  high: '#22C55E',
  medium: '#EAB308',
  low: '#F97316',
  very_low: '#EF4444',
};

/** FE/BE 작업 비율 색상 */
export const TASK_TYPE_COLORS = {
  FE: '#3B82F6',
  BE: '#10B981',
} as const;
