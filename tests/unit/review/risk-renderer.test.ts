/**
 * @module tests/unit/review/risk-renderer
 * @description Risk renderer utility unit tests (REQ-018-A2 / TASK-123)
 */

import {
  partitionRiskAreas,
  renderRiskTable,
  renderRiskBulletList,
  renderRisksSection,
  getImpactLabel,
  getImpactBadge,
  getCategoryLabel,
  sortByImpact,
  countByImpact,
} from '../../../src/core/review/risk-renderer';
import { RiskArea, isRiskAreaObject } from '../../../src/types/analysis';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function createRiskArea(overrides: Partial<RiskArea> = {}): RiskArea {
  return {
    id: 'risk-001',
    description: '역방향 토픽 발행 실패 시 데이터 불일치',
    impact: 'high',
    mitigation: 'Dead Letter Queue 구성 및 재처리 배치 구현',
    relatedProjects: ['lip', 'e-scm-api'],
    relatedTasks: ['task-003'],
    category: 'data-integrity',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  isRiskAreaObject type guard tests                                    */
/* ------------------------------------------------------------------ */

describe('isRiskAreaObject()', () => {
  it('should return true for a valid RiskArea object', () => {
    expect(isRiskAreaObject(createRiskArea())).toBe(true);
  });

  it('should return false for a string', () => {
    expect(isRiskAreaObject('simple string risk')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isRiskAreaObject(null as unknown as string | RiskArea)).toBe(false);
  });

  it('should return false for an object missing description', () => {
    const obj = { impact: 'high', mitigation: 'test' };
    expect(isRiskAreaObject(obj as unknown as string | RiskArea)).toBe(false);
  });

  it('should return false for an object missing impact', () => {
    const obj = { description: 'test', mitigation: 'test' };
    expect(isRiskAreaObject(obj as unknown as string | RiskArea)).toBe(false);
  });

  it('should return true for minimal valid object (description + impact)', () => {
    const obj = { description: 'test', impact: 'low', mitigation: '', relatedProjects: [] };
    expect(isRiskAreaObject(obj as unknown as string | RiskArea)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  partitionRiskAreas tests                                            */
/* ------------------------------------------------------------------ */

describe('partitionRiskAreas()', () => {
  it('should separate string and RiskArea items', () => {
    const mixed: (string | RiskArea)[] = [
      '문자열 리스크 1',
      createRiskArea({ id: 'risk-001' }),
      '문자열 리스크 2',
      createRiskArea({ id: 'risk-002', impact: 'medium' }),
    ];

    const { stringRisks, structuredRisks } = partitionRiskAreas(mixed);
    expect(stringRisks).toHaveLength(2);
    expect(structuredRisks).toHaveLength(2);
    expect(stringRisks[0]).toBe('문자열 리스크 1');
    expect(structuredRisks[0].id).toBe('risk-001');
  });

  it('should handle all-string arrays', () => {
    const { stringRisks, structuredRisks } = partitionRiskAreas(['a', 'b', 'c']);
    expect(stringRisks).toHaveLength(3);
    expect(structuredRisks).toHaveLength(0);
  });

  it('should handle all-RiskArea arrays', () => {
    const risks = [createRiskArea({ id: 'risk-001' }), createRiskArea({ id: 'risk-002' })];
    const { stringRisks, structuredRisks } = partitionRiskAreas(risks);
    expect(stringRisks).toHaveLength(0);
    expect(structuredRisks).toHaveLength(2);
  });

  it('should handle empty arrays', () => {
    const { stringRisks, structuredRisks } = partitionRiskAreas([]);
    expect(stringRisks).toHaveLength(0);
    expect(structuredRisks).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  renderRiskTable tests                                               */
/* ------------------------------------------------------------------ */

describe('renderRiskTable()', () => {
  it('should return empty string for empty array', () => {
    expect(renderRiskTable([])).toBe('');
  });

  it('should render a Markdown table with headers', () => {
    const table = renderRiskTable([createRiskArea()]);
    expect(table).toContain('| ID | 리스크 | 영향도 | 카테고리 | 완화 방안 | 관련 프로젝트 |');
    expect(table).toContain('|:---|');
  });

  it('should include risk data in table rows', () => {
    const risk = createRiskArea({ id: 'risk-test', description: '테스트 리스크' });
    const table = renderRiskTable([risk]);
    expect(table).toContain('risk-test');
    expect(table).toContain('테스트 리스크');
    expect(table).toContain('높음');
    expect(table).toContain('lip, e-scm-api');
  });

  it('should show "-" for missing category', () => {
    const risk = createRiskArea({ category: undefined });
    const table = renderRiskTable([risk]);
    expect(table).toMatch(/\| - \|/);
  });

  it('should show "-" for empty relatedProjects', () => {
    const risk = createRiskArea({ relatedProjects: [] });
    const table = renderRiskTable([risk]);
    // Last column should be "-"
    const lines = table.split('\n');
    const dataRow = lines[2]; // 3rd line is the data row
    expect(dataRow).toMatch(/- \|$/);
  });
});

/* ------------------------------------------------------------------ */
/*  renderRiskBulletList tests                                          */
/* ------------------------------------------------------------------ */

describe('renderRiskBulletList()', () => {
  it('should return empty string for empty array', () => {
    expect(renderRiskBulletList([])).toBe('');
  });

  it('should render bullet list items', () => {
    const result = renderRiskBulletList(['리스크 1', '리스크 2']);
    expect(result).toBe('- 리스크 1\n- 리스크 2');
  });
});

/* ------------------------------------------------------------------ */
/*  renderRisksSection tests                                            */
/* ------------------------------------------------------------------ */

describe('renderRisksSection()', () => {
  it('should render empty state for no risks', () => {
    const result = renderRisksSection([]);
    expect(result).toContain('리스크 및 주의사항');
    expect(result).toContain('분석된 리스크가 없습니다');
  });

  it('should render only bullet list for string-only risks', () => {
    const result = renderRisksSection(['리스크 A', '리스크 B']);
    expect(result).toContain('- 리스크 A');
    expect(result).toContain('- 리스크 B');
    expect(result).not.toContain('추가 주의사항');
  });

  it('should render only table for RiskArea-only risks', () => {
    const result = renderRisksSection([createRiskArea()]);
    expect(result).toContain('| ID |');
    expect(result).not.toContain('추가 주의사항');
  });

  it('should render both table and bullet list for mixed risks', () => {
    const mixed: (string | RiskArea)[] = [
      createRiskArea({ id: 'risk-001' }),
      '문자열 리스크',
    ];
    const result = renderRisksSection(mixed);
    expect(result).toContain('| ID |');
    expect(result).toContain('### 추가 주의사항');
    expect(result).toContain('- 문자열 리스크');
  });

  it('should use custom section number', () => {
    const result = renderRisksSection([], 7);
    expect(result).toContain('## 7. 리스크 및 주의사항');
  });
});

/* ------------------------------------------------------------------ */
/*  Helper function tests                                               */
/* ------------------------------------------------------------------ */

describe('getImpactLabel()', () => {
  it('should return Korean labels', () => {
    expect(getImpactLabel('low')).toBe('낮음');
    expect(getImpactLabel('medium')).toBe('보통');
    expect(getImpactLabel('high')).toBe('높음');
    expect(getImpactLabel('critical')).toBe('심각');
  });
});

describe('getImpactBadge()', () => {
  it('should return emoji badges', () => {
    expect(getImpactBadge('critical')).toContain('🔴');
    expect(getImpactBadge('high')).toContain('🟠');
  });
});

describe('getCategoryLabel()', () => {
  it('should return Korean labels for all categories', () => {
    expect(getCategoryLabel('technical')).toBe('기술');
    expect(getCategoryLabel('data-integrity')).toBe('데이터 무결성');
    expect(getCategoryLabel('performance')).toBe('성능');
    expect(getCategoryLabel('dependency')).toBe('의존성');
    expect(getCategoryLabel('business')).toBe('비즈니스');
  });
});

describe('sortByImpact()', () => {
  it('should sort risks by severity (critical first)', () => {
    const risks = [
      createRiskArea({ id: 'low', impact: 'low' }),
      createRiskArea({ id: 'critical', impact: 'critical' }),
      createRiskArea({ id: 'medium', impact: 'medium' }),
      createRiskArea({ id: 'high', impact: 'high' }),
    ];

    const sorted = sortByImpact(risks);
    expect(sorted[0].id).toBe('critical');
    expect(sorted[1].id).toBe('high');
    expect(sorted[2].id).toBe('medium');
    expect(sorted[3].id).toBe('low');
  });

  it('should not mutate the original array', () => {
    const risks = [
      createRiskArea({ id: 'low', impact: 'low' }),
      createRiskArea({ id: 'high', impact: 'high' }),
    ];
    const sorted = sortByImpact(risks);
    expect(risks[0].id).toBe('low'); // original unchanged
    expect(sorted[0].id).toBe('high');
  });
});

describe('countByImpact()', () => {
  it('should count risks by impact level', () => {
    const risks = [
      createRiskArea({ impact: 'high' }),
      createRiskArea({ impact: 'high' }),
      createRiskArea({ impact: 'low' }),
      createRiskArea({ impact: 'critical' }),
    ];

    const counts = countByImpact(risks);
    expect(counts.critical).toBe(1);
    expect(counts.high).toBe(2);
    expect(counts.medium).toBe(0);
    expect(counts.low).toBe(1);
  });

  it('should return all zeros for empty array', () => {
    const counts = countByImpact([]);
    expect(counts.critical).toBe(0);
    expect(counts.high).toBe(0);
    expect(counts.medium).toBe(0);
    expect(counts.low).toBe(0);
  });
});
