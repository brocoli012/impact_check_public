/**
 * @module core/review/risk-renderer
 * @description Risk matrix rendering utilities for review document generation (REQ-018-A2)
 *
 * Handles both legacy string-based riskAreas and structured RiskArea objects.
 * Used by section-templates.ts (Phase A1) to render the "risks" section of review documents.
 */

import { RiskArea, isRiskAreaObject } from '../../types/analysis';

// ============================================================
// Impact level display helpers
// ============================================================

/** Impact level label mapping (Korean) */
const IMPACT_LABELS: Record<RiskArea['impact'], string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '심각',
};

/** Impact level emoji for Markdown rendering */
const IMPACT_BADGES: Record<RiskArea['impact'], string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

/** Category label mapping (Korean) */
const CATEGORY_LABELS: Record<NonNullable<RiskArea['category']>, string> = {
  'technical': '기술',
  'data-integrity': '데이터 무결성',
  'performance': '성능',
  'dependency': '의존성',
  'business': '비즈니스',
};

// ============================================================
// Rendering functions
// ============================================================

/**
 * Separate riskAreas into string and RiskArea groups
 */
export function partitionRiskAreas(
  riskAreas: (string | RiskArea)[],
): { stringRisks: string[]; structuredRisks: RiskArea[] } {
  const stringRisks: string[] = [];
  const structuredRisks: RiskArea[] = [];

  for (const item of riskAreas) {
    if (isRiskAreaObject(item)) {
      structuredRisks.push(item);
    } else {
      stringRisks.push(item);
    }
  }

  return { stringRisks, structuredRisks };
}

/**
 * Render structured RiskArea items as a Markdown table
 */
export function renderRiskTable(risks: RiskArea[]): string {
  if (risks.length === 0) return '';

  const lines: string[] = [];
  lines.push('| ID | 리스크 | 영향도 | 카테고리 | 완화 방안 | 관련 프로젝트 |');
  lines.push('|:---|:------|:------:|:--------:|:---------|:------------|');

  for (const risk of risks) {
    const impactBadge = `${IMPACT_BADGES[risk.impact]} ${IMPACT_LABELS[risk.impact]}`;
    const category = risk.category ? CATEGORY_LABELS[risk.category] : '-';
    const projects = risk.relatedProjects.length > 0
      ? risk.relatedProjects.join(', ')
      : '-';
    lines.push(
      `| ${risk.id} | ${risk.description} | ${impactBadge} | ${category} | ${risk.mitigation} | ${projects} |`,
    );
  }

  return lines.join('\n');
}

/**
 * Render string-based risk items as a Markdown bullet list
 */
export function renderRiskBulletList(risks: string[]): string {
  if (risks.length === 0) return '';

  return risks.map(risk => `- ${risk}`).join('\n');
}

/**
 * Render the full risks section for a review document.
 * Handles mixed arrays of string and RiskArea items.
 *
 * @param riskAreas - Array of string or RiskArea items
 * @param sectionNumber - Section number for the heading (default: 9)
 * @returns Markdown string for the risks section
 */
export function renderRisksSection(
  riskAreas: (string | RiskArea)[],
  sectionNumber: number = 9,
): string {
  if (riskAreas.length === 0) {
    return `## ${sectionNumber}. 리스크 및 주의사항\n\n분석된 리스크가 없습니다.\n`;
  }

  const { stringRisks, structuredRisks } = partitionRiskAreas(riskAreas);
  const parts: string[] = [];

  parts.push(`## ${sectionNumber}. 리스크 및 주의사항\n`);

  // Structured risks table
  if (structuredRisks.length > 0) {
    parts.push(renderRiskTable(structuredRisks));
    parts.push('');
  }

  // String risks bullet list
  if (stringRisks.length > 0) {
    if (structuredRisks.length > 0) {
      parts.push('### 추가 주의사항\n');
    }
    parts.push(renderRiskBulletList(stringRisks));
  }

  return parts.join('\n');
}

/**
 * Get impact level label in Korean
 */
export function getImpactLabel(impact: RiskArea['impact']): string {
  return IMPACT_LABELS[impact];
}

/**
 * Get impact level badge emoji
 */
export function getImpactBadge(impact: RiskArea['impact']): string {
  return IMPACT_BADGES[impact];
}

/**
 * Get category label in Korean
 */
export function getCategoryLabel(category: NonNullable<RiskArea['category']>): string {
  return CATEGORY_LABELS[category];
}

/**
 * Sort RiskArea items by impact severity (critical first)
 */
export function sortByImpact(risks: RiskArea[]): RiskArea[] {
  const order: Record<RiskArea['impact'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return [...risks].sort((a, b) => order[a.impact] - order[b.impact]);
}

/**
 * Count risks by impact level
 */
export function countByImpact(
  risks: RiskArea[],
): Record<RiskArea['impact'], number> {
  const counts: Record<RiskArea['impact'], number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const risk of risks) {
    counts[risk.impact]++;
  }

  return counts;
}
