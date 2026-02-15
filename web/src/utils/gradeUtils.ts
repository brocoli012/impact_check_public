/**
 * @module web/utils/gradeUtils
 * @description 등급 헬퍼 함수 - 점수 기반 등급 판정 및 포맷팅
 */

import type { Grade } from '../types';
import { GRADE_COLORS, type GradeColorSet } from './colors';

/** 등급 범위 정의 */
const GRADE_RANGES: Array<{ grade: Grade; min: number; max: number }> = [
  { grade: 'Low', min: 0, max: 15 },
  { grade: 'Medium', min: 16, max: 40 },
  { grade: 'High', min: 41, max: 70 },
  { grade: 'Critical', min: 71, max: Infinity },
];

/**
 * 점수를 기반으로 등급 판정
 * @param score - 점수
 * @returns 등급
 */
export function getGradeFromScore(score: number): Grade {
  for (const range of GRADE_RANGES) {
    if (score >= range.min && score <= range.max) {
      return range.grade;
    }
  }
  return 'Critical';
}

/**
 * 등급에 해당하는 색상 세트를 반환
 * @param grade - 등급
 * @returns 색상 세트
 */
export function getGradeColors(grade: Grade): GradeColorSet {
  return GRADE_COLORS[grade] || GRADE_COLORS.Low;
}

/**
 * 등급에 해당하는 한국어 라벨을 반환
 * @param grade - 등급
 * @returns 한국어 라벨
 */
export function getGradeLabel(grade: Grade): string {
  const labels: Record<Grade, string> = {
    Low: '소규모',
    Medium: '중간 규모',
    High: '대규모',
    Critical: '초대규모',
  };
  return labels[grade] || grade;
}

/**
 * 등급에 해당하는 권장 사항을 반환
 * @param grade - 등급
 * @returns 권장 사항
 */
export function getGradeRecommendation(grade: Grade): string {
  const recommendations: Record<Grade, string> = {
    Low: '일반 스프린트 내 처리 가능합니다.',
    Medium: '스프린트 계획 시 우선순위 조정이 필요합니다.',
    High: '별도 프로젝트 계획이 필요합니다.',
    Critical: '아키텍처 리뷰가 필수입니다.',
  };
  return recommendations[grade] || '';
}

/**
 * 날짜 문자열을 한국어 포맷으로 변환
 * @param isoString - ISO 8601 날짜 문자열
 * @returns 포맷팅된 날짜 문자열
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
