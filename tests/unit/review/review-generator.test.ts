/**
 * @module tests/unit/review/review-generator
 * @description Review document generator unit tests (REQ-018-A1)
 */

import { ReviewDocumentGenerator } from '../../../src/core/review/review-generator';
import {
  renderSpecOverview,
  renderImpactSummary,
  renderDataFlowDiagram,
  renderDetailedDataFlow,
  renderUserProcess,
  renderDomainAnalysis,
  renderTaskList,
  renderPlanningChecks,
  renderRiskSection,
  renderResultLocation,
  renderPolicyChanges,
  renderChangelog,
  renderFrontmatter,
} from '../../../src/core/review/section-renderers';
import { ConfidenceEnrichedResult } from '../../../src/types/analysis';
import { REQUIRED_SECTIONS } from '../../../src/types/review';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Create a minimal ConfidenceEnrichedResult for testing
 */
function createMockResult(overrides: Partial<ConfidenceEnrichedResult> = {}): ConfidenceEnrichedResult {
  return {
    analysisId: 'analysis-test-001',
    analyzedAt: '2026-03-10T14:30:00.000Z',
    specTitle: '테스트 기획서',
    analysisMethod: 'rule-based',
    affectedScreens: [
      {
        screenId: 'screen-001',
        screenName: '상품 상세',
        impactLevel: 'high',
        tasks: [],
      },
    ],
    tasks: [
      {
        id: 'task-001',
        title: 'API 확장',
        type: 'BE',
        actionType: 'modify',
        description: 'SKU API 확장',
        affectedFiles: ['src/api/sku.ts'],
        relatedApis: ['api-001'],
        planningChecks: [],
        rationale: '기획서 요구사항 반영',
      },
      {
        id: 'task-002',
        title: 'UI 수정',
        type: 'FE',
        actionType: 'modify',
        description: '상품 상세 UI 수정',
        affectedFiles: ['src/pages/Product.tsx'],
        relatedApis: [],
        planningChecks: [],
        rationale: '화면 변경',
      },
    ],
    planningChecks: [
      {
        id: 'check-001',
        content: 'API 스키마 확정 필요',
        relatedFeatureId: 'feat-001',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'check-002',
        content: 'UI 디자인 확인',
        relatedFeatureId: 'feat-002',
        priority: 'medium',
        status: 'pending',
      },
    ],
    policyChanges: [
      {
        id: 'pc-001',
        policyName: '데이터 동기화 정책',
        description: '역방향 동기화 추가',
        changeType: 'new',
        affectedFiles: ['src/kafka/producer.ts'],
        requiresReview: true,
      },
    ],
    policyWarnings: [
      {
        id: 'pw-001',
        policyId: 'policy-001',
        policyName: '데이터 무결성 정책',
        message: '역방향 토픽 관련 정책 확인 필요',
        severity: 'warning',
        relatedTaskIds: ['task-001'],
      },
    ],
    ownerNotifications: [],
    screenScores: [
      {
        screenId: 'screen-001',
        screenName: '상품 상세',
        screenScore: 75,
        grade: 'High',
        taskScores: [],
      },
    ],
    totalScore: 75,
    grade: 'High',
    recommendation: '주의 깊은 코드 리뷰 필요',
    confidenceScores: [],
    lowConfidenceWarnings: [],
    parsedSpec: {
      title: '테스트 기획서 - 물류상품 속성 이전',
      requirements: [
        {
          id: 'req-001',
          name: '컬럼 이관',
          description: '20개 컬럼 수정 권한 이전',
          priority: 'must',
          relatedFeatures: ['feat-001'],
        },
      ],
      features: [
        {
          id: 'feat-001',
          name: '수정 UI 추가',
          description: '컬리옵스에 편집 기능 추가',
          targetScreen: '상품 상세',
          actionType: 'modify',
          keywords: ['수정', '편집'],
        },
      ],
      businessRules: [],
      targetScreens: ['상품 상세', '상품 목록'],
      keywords: ['물류', '상품', '속성'],
      ambiguities: [],
    },
    analysisSummary: {
      overview: '물류상품 속성 20개 컬럼의 수정 권한을 이전하는 프로젝트',
      keyFindings: [
        '역방향 Kafka 토픽 필요',
        '파손검품/당도검품 필드 GAP 발견',
        '발주/정산 시스템 의존성 존재',
      ],
      riskAreas: [
        {
          id: 'risk-001',
          description: '역방향 토픽 발행 실패 시 데이터 불일치',
          impact: 'high',
          mitigation: 'DLQ + 재처리 로직',
          relatedProjects: ['lip', 'e-scm-api'],
          category: 'data-integrity',
        },
        '기존 기능 회귀 테스트 필요',
      ],
      currentProblems: ['파트너포털에서만 수정 가능한 구조'],
      dataFlowChanges: [
        {
          area: '물류속성 수정 흐름',
          before: '파트너포털 -> Kafka -> LIP (단방향)',
          after: '컬리옵스 -> LIP -> 역방향 Kafka -> eSCM (양방향)',
          description: '수정 권한 이전에 따른 양방향 동기화 추가',
        },
      ],
      processChanges: [
        {
          processName: '물류속성 수정',
          before: ['파트너포털 진입', '20개 컬럼 수정', 'Kafka 전송', 'LIP 저장'],
          after: ['컬리옵스 진입', '20개 컬럼 수정', 'LIP 저장', '역방향 Kafka 전송', 'eSCM DB 동기화'],
          changedSteps: [0, 3, 4],
        },
      ],
    },
    ...overrides,
  } as ConfidenceEnrichedResult;
}

/* ------------------------------------------------------------------ */
/*  ReviewDocumentGenerator tests                                       */
/* ------------------------------------------------------------------ */

describe('ReviewDocumentGenerator', () => {
  describe('generate()', () => {
    it('should generate a complete review document', () => {
      const generator = new ReviewDocumentGenerator({ projectId: 'test-project' });
      const result = createMockResult();
      const doc = generator.generate(result);

      expect(doc).toBeDefined();
      expect(doc.metadata).toBeDefined();
      expect(doc.sections).toBeDefined();
      expect(doc.markdown).toBeDefined();
      expect(doc.markdown.length).toBeGreaterThan(0);
    });

    it('should include metadata in the document', () => {
      const generator = new ReviewDocumentGenerator({ projectId: 'lip' });
      const result = createMockResult();
      const doc = generator.generate(result);

      expect(doc.metadata.generatedBy).toContain('KIC');
      expect(doc.metadata.projectId).toBe('lip');
      expect(doc.metadata.analysisId).toBe('analysis-test-001');
      expect(doc.metadata.specTitle).toBe('테스트 기획서');
      expect(doc.metadata.totalScore).toBe(75);
      expect(doc.metadata.grade).toBe('High');
      expect(doc.metadata.taskCount).toBe(2);
    });

    it('should include YAML frontmatter in markdown', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult();
      const doc = generator.generate(result);

      expect(doc.markdown).toContain('---');
      expect(doc.markdown).toContain('generatedBy: KIC');
      expect(doc.markdown).toContain('analysisId: analysis-test-001');
    });

    it('should include document title', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult();
      const doc = generator.generate(result);

      expect(doc.markdown).toContain('# 테스트 기획서 - 기획 검토 결과서');
    });

    it('should include table of contents', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult();
      const doc = generator.generate(result);

      expect(doc.markdown).toContain('## 목차');
    });

    it('should render required sections', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult();
      const doc = generator.generate(result);

      // Required sections should always be rendered
      expect(doc.markdown).toContain('## 1. 기획 개요');
      expect(doc.markdown).toContain('## 2. 영향 범위 분석 요약');
      expect(doc.markdown).toContain('## 7. 전체 태스크 목록');
      expect(doc.markdown).toContain('## 10. 분석 결과 저장 위치');
      expect(doc.markdown).toContain('## 12. 변경 이력');
    });

    it('should render conditional sections when data exists', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult();
      const doc = generator.generate(result);

      // Should render because planningChecks exist
      expect(doc.markdown).toContain('## 8. 기획 확인 필요 사항');
      // Should render because policyChanges exist
      expect(doc.markdown).toContain('## 11. 정책 변경 사항');
      // Should render because keyFindings >= 2
      expect(doc.markdown).toContain('## 6. 도메인 특화 분석');
    });

    it('should skip conditional sections when no data', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult({
        planningChecks: [],
        policyChanges: [],
        policyWarnings: [],
        analysisSummary: {
          overview: 'test',
          keyFindings: ['only one'],
          riskAreas: [],
        },
      });
      const doc = generator.generate(result);

      // Should NOT render because planningChecks empty
      expect(doc.markdown).not.toContain('## 8. 기획 확인 필요 사항');
      // Should NOT render because policyChanges/Warnings empty
      expect(doc.markdown).not.toContain('## 11. 정책 변경 사항');
      // Should NOT render because keyFindings < 2
      expect(doc.markdown).not.toContain('## 6. 도메인 특화 분석');
    });

    it('should track section render results', () => {
      const generator = new ReviewDocumentGenerator();
      const result = createMockResult();
      const doc = generator.generate(result);

      // At least required sections should be present
      const successSections = doc.sections.filter(s => s.success);
      expect(successSections.length).toBeGreaterThanOrEqual(REQUIRED_SECTIONS.length);

      // Skipped sections should have reasons
      const skippedSections = doc.sections.filter(s => !s.success);
      for (const s of skippedSections) {
        expect(s.skipReason).toBeDefined();
        expect(s.skipReason!.length).toBeGreaterThan(0);
      }
    });

    it('should respect includeSections option', () => {
      const generator = new ReviewDocumentGenerator({
        includeSections: ['overview', 'task-list'],
      });
      const result = createMockResult();
      const doc = generator.generate(result);

      // Only requested sections should be in results
      expect(doc.sections).toHaveLength(2);
      expect(doc.sections[0].type).toBe('overview');
      expect(doc.sections[1].type).toBe('task-list');

      expect(doc.markdown).toContain('## 1. 기획 개요');
      expect(doc.markdown).toContain('## 7. 전체 태스크 목록');
      // Should not contain other sections
      expect(doc.markdown).not.toContain('## 2. 영향 범위 분석 요약');
    });
  });

  describe('generateFromFile()', () => {
    it('should throw error for non-existent file', () => {
      const generator = new ReviewDocumentGenerator();
      expect(() => generator.generateFromFile('/tmp/non-existent-file.json')).toThrow(
        '분석 결과 파일을 찾을 수 없습니다',
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Section renderer unit tests                                         */
/* ------------------------------------------------------------------ */

describe('Section Renderers', () => {
  let mockResult: ConfidenceEnrichedResult;

  beforeEach(() => {
    mockResult = createMockResult();
  });

  describe('renderSpecOverview()', () => {
    it('should render spec overview with parsedSpec', () => {
      const output = renderSpecOverview(mockResult);
      expect(output).toContain('## 1. 기획 개요');
      expect(output).toContain('테스트 기획서 - 물류상품 속성 이전');
      expect(output).toContain('### 1.2 요구사항');
      expect(output).toContain('### 1.3 기능 목록');
    });

    it('should handle missing parsedSpec gracefully', () => {
      const result = createMockResult({ parsedSpec: undefined });
      const output = renderSpecOverview(result);
      expect(output).toContain('## 1. 기획 개요');
      expect(output).toContain('기획서 정보가 분석 결과에 포함되지 않았습니다');
      expect(output).toContain('테스트 기획서');
    });
  });

  describe('renderImpactSummary()', () => {
    it('should render impact summary with scores', () => {
      const output = renderImpactSummary(mockResult);
      expect(output).toContain('## 2. 영향 범위 분석 요약');
      expect(output).toContain('**75**');
      expect(output).toContain('High');
      expect(output).toContain('2건');
      expect(output).toContain('1개');
    });

    it('should render score distribution chart', () => {
      const output = renderImpactSummary(mockResult);
      expect(output).toContain('상품 상세');
      expect(output).toContain('```');
    });
  });

  describe('renderDataFlowDiagram()', () => {
    it('should render data flow changes with Mermaid diagrams when present', () => {
      const output = renderDataFlowDiagram(mockResult);
      expect(output).toContain('## 3. 데이터 흐름도');
      expect(output).toContain('```mermaid');
      expect(output).toContain('flowchart LR');
      expect(output).toContain('물류속성 수정 흐름');
    });

    it('should return empty string when no data flow changes', () => {
      const result = createMockResult({
        analysisSummary: {
          overview: 'test',
          keyFindings: [],
          riskAreas: [],
          dataFlowChanges: [],
        },
      });
      expect(renderDataFlowDiagram(result)).toBe('');
    });

    it('should return empty string when no analysisSummary', () => {
      const result = createMockResult({ analysisSummary: undefined });
      expect(renderDataFlowDiagram(result)).toBe('');
    });
  });

  describe('renderDetailedDataFlow()', () => {
    it('should render process changes when present', () => {
      const output = renderDetailedDataFlow(mockResult);
      expect(output).toContain('## 4. 상세 데이터 흐름');
      expect(output).toContain('물류속성 수정');
      expect(output).toContain('[CHANGED]');
    });

    it('should return empty string when no process changes', () => {
      const result = createMockResult({
        analysisSummary: {
          overview: 'test',
          keyFindings: [],
          riskAreas: [],
          processChanges: [],
        },
      });
      expect(renderDetailedDataFlow(result)).toBe('');
    });
  });

  describe('renderUserProcess()', () => {
    it('should render user process with Mermaid flowchart when process changes exist', () => {
      const output = renderUserProcess(mockResult);
      expect(output).toContain('## 5. 사용자 이용 프로세스');
      expect(output).toContain('```mermaid');
      expect(output).toContain('flowchart TD');
    });

    it('should return empty string when no process changes', () => {
      const result = createMockResult({
        analysisSummary: {
          overview: 'test',
          keyFindings: [],
          riskAreas: [],
        },
      });
      expect(renderUserProcess(result)).toBe('');
    });
  });

  describe('renderDomainAnalysis()', () => {
    it('should render domain analysis when keyFindings >= 2', () => {
      const output = renderDomainAnalysis(mockResult);
      expect(output).toContain('## 6. 도메인 특화 분석');
      expect(output).toContain('역방향 Kafka 토픽 필요');
      expect(output).toContain('현재 시스템 문제점');
    });

    it('should return empty string when keyFindings < 2', () => {
      const result = createMockResult({
        analysisSummary: {
          overview: 'test',
          keyFindings: ['only one finding'],
          riskAreas: [],
        },
      });
      expect(renderDomainAnalysis(result)).toBe('');
    });

    it('should return empty string when no analysisSummary', () => {
      const result = createMockResult({ analysisSummary: undefined });
      expect(renderDomainAnalysis(result)).toBe('');
    });
  });

  describe('renderTaskList()', () => {
    it('should render task table', () => {
      const output = renderTaskList(mockResult);
      expect(output).toContain('## 7. 전체 태스크 목록');
      expect(output).toContain('task-001');
      expect(output).toContain('API 확장');
      expect(output).toContain('task-002');
      expect(output).toContain('UI 수정');
    });

    it('should handle empty tasks', () => {
      const result = createMockResult({ tasks: [] });
      const output = renderTaskList(result);
      expect(output).toContain('분석된 태스크가 없습니다');
    });
  });

  describe('renderPlanningChecks()', () => {
    it('should render planning checks grouped by priority', () => {
      const output = renderPlanningChecks(mockResult);
      expect(output).toContain('## 8. 기획 확인 필요 사항');
      expect(output).toContain('우선순위 High');
      expect(output).toContain('API 스키마 확정 필요');
      expect(output).toContain('우선순위 Medium');
      expect(output).toContain('UI 디자인 확인');
    });

    it('should return empty string when no planning checks', () => {
      const result = createMockResult({ planningChecks: [] });
      expect(renderPlanningChecks(result)).toBe('');
    });
  });

  describe('renderRiskSection()', () => {
    it('should render risks using risk-renderer', () => {
      const output = renderRiskSection(mockResult);
      expect(output).toContain('## 9. 리스크 및 주의사항');
      expect(output).toContain('risk-001');
      expect(output).toContain('기존 기능 회귀 테스트 필요');
    });

    it('should handle empty risks', () => {
      const result = createMockResult({
        analysisSummary: {
          overview: 'test',
          keyFindings: [],
          riskAreas: [],
        },
      });
      const output = renderRiskSection(result);
      expect(output).toContain('분석된 리스크가 없습니다');
    });
  });

  describe('renderResultLocation()', () => {
    it('should render result location info', () => {
      const output = renderResultLocation(mockResult);
      expect(output).toContain('## 10. 분석 결과 저장 위치');
      expect(output).toContain('analysis-test-001');
      expect(output).toContain('2026-03-10T14:30:00.000Z');
    });
  });

  describe('renderPolicyChanges()', () => {
    it('should render policy changes and warnings', () => {
      const output = renderPolicyChanges(mockResult);
      expect(output).toContain('## 11. 정책 변경 사항');
      expect(output).toContain('데이터 동기화 정책');
      expect(output).toContain('데이터 무결성 정책');
    });

    it('should return empty string when no changes or warnings', () => {
      const result = createMockResult({
        policyChanges: [],
        policyWarnings: [],
      });
      expect(renderPolicyChanges(result)).toBe('');
    });
  });

  describe('renderChangelog()', () => {
    it('should render changelog with analysis date', () => {
      const output = renderChangelog(mockResult);
      expect(output).toContain('## 12. 변경 이력');
      expect(output).toContain('2026-03-10');
      expect(output).toContain('2태스크');
      expect(output).toContain('75점');
    });
  });

  describe('renderFrontmatter()', () => {
    it('should render YAML frontmatter', () => {
      const output = renderFrontmatter(mockResult, ['overview', 'task-list']);
      expect(output).toContain('---');
      expect(output).toContain('generatedBy: KIC (Kurly Impact Checker) v1.0');
      expect(output).toContain('analysisId: analysis-test-001');
      expect(output).toContain('specTitle: 테스트 기획서');
      expect(output).toContain('totalScore: 75');
      expect(output).toContain('grade: High');
      expect(output).toContain('sections: [overview, task-list]');
    });
  });
});
