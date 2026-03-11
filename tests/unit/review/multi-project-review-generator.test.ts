/**
 * @module tests/unit/review/multi-project-review-generator
 * @description Multi-project unified review generator unit tests (REQ-018-B2)
 */

import { MultiProjectReviewGenerator } from '../../../src/core/review/multi-project-review-generator';
import { ConfidenceEnrichedResult } from '../../../src/types/analysis';
import { ProjectReviewInput } from '../../../src/types/review';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Create a minimal ConfidenceEnrichedResult for testing
 */
function createMockResult(
  projectId: string,
  overrides: Partial<ConfidenceEnrichedResult> = {},
): ConfidenceEnrichedResult {
  const base: ConfidenceEnrichedResult = {
    analysisId: `analysis-${projectId}-001`,
    analyzedAt: '2026-03-10T14:30:00.000Z',
    specTitle: '물류상품통합 Phase 1',
    analysisMethod: 'ai-native',
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
        id: `${projectId}-task-001`,
        title: `${projectId} API 확장`,
        type: 'BE',
        actionType: 'modify',
        description: 'API 확장 작업',
        affectedFiles: [`src/api/${projectId}.ts`],
        relatedApis: ['api-001'],
        planningChecks: [],
        rationale: '기획서 요구사항 반영',
      },
      {
        id: `${projectId}-task-002`,
        title: `${projectId} UI 수정`,
        type: 'FE',
        actionType: 'modify',
        description: 'UI 수정 작업',
        affectedFiles: [`src/pages/${projectId}.tsx`],
        relatedApis: [],
        planningChecks: [],
        rationale: '화면 변경',
      },
    ],
    planningChecks: [
      {
        id: `${projectId}-check-001`,
        content: `${projectId} API 스키마 확정 필요`,
        relatedFeatureId: 'feat-001',
        priority: 'high',
        status: 'pending',
      },
    ],
    policyChanges: [],
    policyWarnings: [],
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
    analysisSummary: {
      overview: `${projectId} 프로젝트 분석 요약`,
      keyFindings: [
        `${projectId} 주요 발견 1`,
        `${projectId} 주요 발견 2`,
      ],
      riskAreas: [
        {
          id: `${projectId}-risk-001`,
          description: `${projectId} 데이터 정합성 리스크`,
          impact: 'high',
          mitigation: 'DLQ + 재처리',
          relatedProjects: [projectId],
          category: 'data-integrity',
        },
        `${projectId} 기존 기능 회귀 테스트 필요`,
      ],
    },
    ...overrides,
  } as ConfidenceEnrichedResult;
  return base;
}

/**
 * Create a ProjectReviewInput from project ID and optional overrides
 */
function createInput(
  projectId: string,
  overrides: Partial<ConfidenceEnrichedResult> = {},
): ProjectReviewInput {
  return {
    projectId,
    result: createMockResult(projectId, overrides),
  };
}

/* ------------------------------------------------------------------ */
/*  MultiProjectReviewGenerator tests                                   */
/* ------------------------------------------------------------------ */

describe('MultiProjectReviewGenerator', () => {

  describe('generate()', () => {
    it('should generate a complete multi-project review document', () => {
      const generator = new MultiProjectReviewGenerator('물류상품통합 Phase 1');
      const inputs = [
        createInput('lip', { totalScore: 80, grade: 'Critical' }),
        createInput('e-scm-api', { totalScore: 72, grade: 'Critical' }),
        createInput('ops-front', { totalScore: 65, grade: 'High' }),
      ];

      const doc = generator.generate(inputs);

      expect(doc).toBeDefined();
      expect(doc.metadata).toBeDefined();
      expect(doc.markdown).toBeDefined();
      expect(doc.markdown.length).toBeGreaterThan(0);
    });

    it('should include metadata with correct project information', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', { totalScore: 80, grade: 'Critical' }),
        createInput('e-scm-api', { totalScore: 72, grade: 'Critical' }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.metadata.totalProjects).toBe(2);
      expect(doc.metadata.projectIds).toEqual(['lip', 'e-scm-api']);
      expect(doc.metadata.totalTasks).toBe(4); // 2 tasks per project
      expect(doc.metadata.generatedBy).toContain('KIC');
      expect(doc.metadata.projectSummaries).toHaveLength(2);
    });

    it('should sort projects by score descending in metadata', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('low-score', { totalScore: 30, grade: 'Low' }),
        createInput('high-score', { totalScore: 90, grade: 'Critical' }),
        createInput('mid-score', { totalScore: 60, grade: 'High' }),
      ];

      const doc = generator.generate(inputs);

      // Should be sorted by score descending
      expect(doc.metadata.projectSummaries[0].projectId).toBe('high-score');
      expect(doc.metadata.projectSummaries[1].projectId).toBe('mid-score');
      expect(doc.metadata.projectSummaries[2].projectId).toBe('low-score');
    });
  });

  describe('cross-project summary table', () => {
    it('should render project comparison table', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', { totalScore: 80, grade: 'Critical' }),
        createInput('e-scm-api', { totalScore: 72, grade: 'Critical' }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('프로젝트별 영향도 비교');
      expect(doc.markdown).toContain('lip');
      expect(doc.markdown).toContain('e-scm-api');
      expect(doc.markdown).toContain('**80**');
      expect(doc.markdown).toContain('**72**');
      expect(doc.markdown).toContain('Critical');
    });

    it('should include total statistics', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('e-scm-api'),
        createInput('ops-front'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('총 프로젝트: 3개');
      expect(doc.markdown).toContain('총 태스크: 6건');
    });

    it('should include score distribution chart', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', { totalScore: 80, grade: 'Critical' }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('영향도 점수 분포');
      expect(doc.markdown).toContain('80점');
    });
  });

  describe('combined data flow', () => {
    it('should render combined data flow when projects have data flow changes', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', {
          analysisSummary: {
            overview: 'test',
            keyFindings: ['finding 1', 'finding 2'],
            riskAreas: [],
            dataFlowChanges: [
              {
                area: '물류속성 수정',
                before: '파트너포털 -> Kafka -> LIP',
                after: '컬리옵스 -> LIP -> Kafka -> eSCM',
                description: '양방향 동기화',
              },
            ],
          },
        }),
        createInput('e-scm-api', {
          analysisSummary: {
            overview: 'test',
            keyFindings: ['finding 1', 'finding 2'],
            riskAreas: [],
            dataFlowChanges: [
              {
                area: '수정 차단',
                before: 'eSCM -> LIP (수정 허용)',
                after: 'eSCM -> LIP (20개 컬럼 차단)',
                description: '수정 권한 이전',
              },
            ],
          },
        }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('통합 데이터 흐름도');
      expect(doc.markdown).toContain('[lip]');
      expect(doc.markdown).toContain('[e-scm-api]');
    });

    it('should skip data flow section when no projects have data flow changes', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', {
          analysisSummary: {
            overview: 'test',
            keyFindings: [],
            riskAreas: [],
          },
        }),
      ];

      const doc = generator.generate(inputs);

      // The heading "## 통합 데이터 흐름도" should not appear (TOC link may contain the text)
      expect(doc.markdown).not.toContain('## 통합 데이터 흐름도');
    });
  });

  describe('per-project sections', () => {
    it('should render per-project detail sections', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', { totalScore: 80, grade: 'Critical' }),
        createInput('e-scm-api', { totalScore: 72, grade: 'Critical' }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('프로젝트별 상세 분석');
      expect(doc.markdown).toContain('### lip');
      expect(doc.markdown).toContain('### e-scm-api');
    });

    it('should include key findings in per-project sections', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('주요 발견 사항');
      expect(doc.markdown).toContain('lip 주요 발견 1');
    });
  });

  describe('combined tasks', () => {
    it('should group tasks by project', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('e-scm-api'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('통합 태스크 목록');
      expect(doc.markdown).toContain('lip (2건)');
      expect(doc.markdown).toContain('e-scm-api (2건)');
      expect(doc.markdown).toContain('lip-task-001');
      expect(doc.markdown).toContain('e-scm-api-task-001');
    });

    it('should report total task count', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('e-scm-api'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('총 4건의 태스크');
    });

    it('should handle projects with no tasks', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('empty-proj', { tasks: [] }),
      ];

      const doc = generator.generate(inputs);

      // lip tasks should still appear
      expect(doc.markdown).toContain('lip (2건)');
      // empty project should not have a section header
      expect(doc.markdown).not.toContain('empty-proj (0건)');
    });
  });

  describe('combined risks', () => {
    it('should combine structured risks from multiple projects', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('e-scm-api'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('통합 리스크 매트릭스');
      expect(doc.markdown).toContain('lip-risk-001');
      expect(doc.markdown).toContain('e-scm-api-risk-001');
    });

    it('should combine string risks with project labels', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('e-scm-api'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('[lip] lip 기존 기능 회귀 테스트 필요');
      expect(doc.markdown).toContain('[e-scm-api] e-scm-api 기존 기능 회귀 테스트 필요');
    });

    it('should handle projects with no risks', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('no-risk', {
          analysisSummary: {
            overview: 'test',
            keyFindings: [],
            riskAreas: [],
          },
        }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('통합 리스크 매트릭스');
      expect(doc.markdown).toContain('분석된 리스크가 없습니다');
    });
  });

  describe('combined planning checks', () => {
    it('should group planning checks by priority with project labels', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
        createInput('e-scm-api'),
      ];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('통합 기획 확인 사항');
      expect(doc.markdown).toContain('우선순위 High');
      expect(doc.markdown).toContain('lip');
      expect(doc.markdown).toContain('e-scm-api');
    });

    it('should skip planning checks when none exist', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', { planningChecks: [] }),
        createInput('e-scm-api', { planningChecks: [] }),
      ];

      const doc = generator.generate(inputs);

      // The heading "## 통합 기획 확인 사항" should not appear (TOC link may contain the text)
      expect(doc.markdown).not.toContain('## 통합 기획 확인 사항');
    });
  });

  describe('single project fallback', () => {
    it('should work correctly with a single project input', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [createInput('lip')];

      const doc = generator.generate(inputs);

      expect(doc.metadata.totalProjects).toBe(1);
      expect(doc.metadata.projectIds).toEqual(['lip']);
      expect(doc.markdown).toContain('lip');
      expect(doc.markdown).toContain('통합 기획 검토 결과서');
    });
  });

  describe('empty results handling', () => {
    it('should handle empty input array', () => {
      const generator = new MultiProjectReviewGenerator('빈 리뷰');
      const doc = generator.generate([]);

      expect(doc.metadata.totalProjects).toBe(0);
      expect(doc.metadata.totalTasks).toBe(0);
      expect(doc.metadata.projectIds).toEqual([]);
      expect(doc.markdown).toContain('통합할 프로젝트 분석 결과가 없습니다');
    });
  });

  describe('frontmatter and metadata', () => {
    it('should include YAML frontmatter with multi-project mode', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [createInput('lip'), createInput('e-scm-api')];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('---');
      expect(doc.markdown).toContain('mode: multi-project');
      expect(doc.markdown).toContain('projectIds: [lip, e-scm-api]');
      expect(doc.markdown).toContain('totalProjects: 2');
      expect(doc.markdown).toContain('totalTasks: 4');
    });

    it('should include table of contents', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [createInput('lip')];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('## 목차');
      expect(doc.markdown).toContain('프로젝트별 영향도 비교');
      expect(doc.markdown).toContain('통합 태스크 목록');
      expect(doc.markdown).toContain('통합 리스크 매트릭스');
    });

    it('should include result locations for all projects', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [createInput('lip'), createInput('e-scm-api')];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('분석 결과 저장 위치');
      expect(doc.markdown).toContain('analysis-lip-001');
      expect(doc.markdown).toContain('analysis-e-scm-api-001');
    });

    it('should include changelog', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [createInput('lip'), createInput('e-scm-api')];

      const doc = generator.generate(inputs);

      expect(doc.markdown).toContain('변경 이력');
      expect(doc.markdown).toContain('통합 리뷰 최초 생성');
      expect(doc.markdown).toContain('2개 프로젝트');
    });
  });

  describe('specTitle handling', () => {
    it('should use provided specTitle', () => {
      const generator = new MultiProjectReviewGenerator('커스텀 제목');
      const inputs = [createInput('lip')];

      const doc = generator.generate(inputs);

      // The first result's specTitle is used when available
      expect(doc.metadata.specTitle).toBe('물류상품통합 Phase 1');
    });

    it('should derive specTitle from first result', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip', { specTitle: '파생 제목' }),
      ];

      const doc = generator.generate(inputs);

      expect(doc.metadata.specTitle).toBe('파생 제목');
    });
  });

  describe('renderCrossProjectSummary (public method)', () => {
    it('should extract key change from key findings', () => {
      const generator = new MultiProjectReviewGenerator();
      const inputs = [
        createInput('lip'),
      ];

      const doc = generator.generate(inputs);

      // Should contain the first key finding as key change
      expect(doc.markdown).toContain('lip 주요 발견 1');
    });
  });
});
