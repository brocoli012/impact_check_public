/**
 * @module tests/unit/analysis/scorer
 * @description Scorer 단위 테스트
 */

import { Scorer } from '../../../src/core/analysis/scorer';
import { ImpactResult, Task } from '../../../src/types/analysis';
import { ScoreBreakdown, SCORE_WEIGHTS, GRADE_THRESHOLDS } from '../../../src/types/scoring';

/** 테스트용 ImpactResult 생성 */
function createTestImpactResult(tasks: Task[]): ImpactResult {
  return {
    analysisId: 'test-analysis',
    analyzedAt: new Date().toISOString(),
    specTitle: '테스트 기획서',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: 'CartPage',
        impactLevel: 'medium',
        tasks,
      },
    ],
    tasks,
    planningChecks: [],
    policyChanges: [],
    analysisMethod: 'rule-based' as const,
  };
}

describe('Scorer', () => {
  let scorer: Scorer;

  beforeEach(() => {
    scorer = new Scorer();
  });

  describe('calculateTaskScore', () => {
    it('should calculate weighted sum correctly', () => {
      const breakdown: ScoreBreakdown = {
        developmentComplexity: { score: 5, weight: 0.35, rationale: '' },
        impactScope: { score: 4, weight: 0.30, rationale: '' },
        policyChange: { score: 3, weight: 0.20, rationale: '' },
        dependencyRisk: { score: 2, weight: 0.15, rationale: '' },
      };

      const score = scorer.calculateTaskScore(breakdown);

      // 5*0.35 + 4*0.30 + 3*0.20 + 2*0.15 = 1.75 + 1.20 + 0.60 + 0.30 = 3.85
      expect(score).toBeCloseTo(3.85, 2);
    });

    it('should use correct weights', () => {
      expect(SCORE_WEIGHTS.developmentComplexity).toBe(0.35);
      expect(SCORE_WEIGHTS.impactScope).toBe(0.30);
      expect(SCORE_WEIGHTS.policyChange).toBe(0.20);
      expect(SCORE_WEIGHTS.dependencyRisk).toBe(0.15);

      // 가중치 합이 1.0
      const sum =
        SCORE_WEIGHTS.developmentComplexity +
        SCORE_WEIGHTS.impactScope +
        SCORE_WEIGHTS.policyChange +
        SCORE_WEIGHTS.dependencyRisk;
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should return minimum score for all-1 breakdown', () => {
      const breakdown: ScoreBreakdown = {
        developmentComplexity: { score: 1, weight: 0.35, rationale: '' },
        impactScope: { score: 1, weight: 0.30, rationale: '' },
        policyChange: { score: 1, weight: 0.20, rationale: '' },
        dependencyRisk: { score: 1, weight: 0.15, rationale: '' },
      };

      const score = scorer.calculateTaskScore(breakdown);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it('should return maximum score for all-10 breakdown', () => {
      const breakdown: ScoreBreakdown = {
        developmentComplexity: { score: 10, weight: 0.35, rationale: '' },
        impactScope: { score: 10, weight: 0.30, rationale: '' },
        policyChange: { score: 10, weight: 0.20, rationale: '' },
        dependencyRisk: { score: 10, weight: 0.15, rationale: '' },
      };

      const score = scorer.calculateTaskScore(breakdown);
      expect(score).toBeCloseTo(10.0, 2);
    });
  });

  describe('calculateScreenScore', () => {
    it('should sum task scores', () => {
      const taskScores = [
        {
          taskId: 'T-001',
          scores: {} as ScoreBreakdown,
          totalScore: 3.5,
          grade: 'Medium' as const,
        },
        {
          taskId: 'T-002',
          scores: {} as ScoreBreakdown,
          totalScore: 5.0,
          grade: 'Medium' as const,
        },
      ];

      const screenScore = scorer.calculateScreenScore(taskScores);
      expect(screenScore).toBeCloseTo(8.5, 2);
    });

    it('should return 0 for empty task scores', () => {
      const screenScore = scorer.calculateScreenScore([]);
      expect(screenScore).toBe(0);
    });
  });

  describe('calculateTotalScore', () => {
    it('should determine Low grade for score 0~15', () => {
      const screens = [
        {
          screenId: 'screen-1',
          screenName: 'Test',
          screenScore: 10,
          grade: 'Low' as const,
          taskScores: [],
        },
      ];

      const { totalScore, grade } = scorer.calculateTotalScore(screens);
      expect(totalScore).toBe(10);
      expect(grade).toBe('Low');
    });

    it('should determine Medium grade for score 16~40', () => {
      const screens = [
        {
          screenId: 'screen-1',
          screenName: 'Test',
          screenScore: 25,
          grade: 'Medium' as const,
          taskScores: [],
        },
      ];

      const { totalScore, grade } = scorer.calculateTotalScore(screens);
      expect(totalScore).toBe(25);
      expect(grade).toBe('Medium');
    });

    it('should determine High grade for score 41~70', () => {
      const screens = [
        {
          screenId: 'screen-1',
          screenName: 'Test1',
          screenScore: 30,
          grade: 'High' as const,
          taskScores: [],
        },
        {
          screenId: 'screen-2',
          screenName: 'Test2',
          screenScore: 25,
          grade: 'High' as const,
          taskScores: [],
        },
      ];

      const { totalScore, grade } = scorer.calculateTotalScore(screens);
      expect(totalScore).toBe(55);
      expect(grade).toBe('High');
    });

    it('should determine Critical grade for score 71+', () => {
      const screens = [
        {
          screenId: 'screen-1',
          screenName: 'Test1',
          screenScore: 40,
          grade: 'Critical' as const,
          taskScores: [],
        },
        {
          screenId: 'screen-2',
          screenName: 'Test2',
          screenScore: 40,
          grade: 'Critical' as const,
          taskScores: [],
        },
      ];

      const { totalScore, grade } = scorer.calculateTotalScore(screens);
      expect(totalScore).toBe(80);
      expect(grade).toBe('Critical');
    });
  });

  describe('score (rule-based)', () => {
    it('should score a simple modify task', async () => {
      const task: Task = {
        id: 'T-001',
        title: 'CSS 수정',
        type: 'FE',
        actionType: 'modify',
        description: '버튼 색상 변경',
        affectedFiles: ['src/components/Button.css'],
        relatedApis: [],
        planningChecks: [],
        rationale: '단순 CSS 수정',
      };

      const impact = createTestImpactResult([task]);
      const result = await scorer.score(impact);

      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.grade).toBeDefined();
      expect(result.recommendation).toBeTruthy();
      expect(result.screenScores).toHaveLength(1);
      expect(result.screenScores[0].taskScores).toHaveLength(1);
    });

    it('should score higher for new feature tasks', async () => {
      const simpleTask: Task = {
        id: 'T-001',
        title: '설정 변경',
        type: 'FE',
        actionType: 'config',
        description: '설정값 변경',
        affectedFiles: ['src/config.ts'],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      };

      const complexTask: Task = {
        id: 'T-002',
        title: '신규 화면 개발',
        type: 'FE',
        actionType: 'new',
        description: '신규 화면 개발',
        affectedFiles: [
          'src/pages/NewPage.tsx',
          'src/components/NewComponent.tsx',
          'src/api/newApi.ts',
          'src/models/newModel.ts',
        ],
        relatedApis: ['api-1', 'api-2', 'api-3'],
        planningChecks: ['확인 필요'],
        rationale: '',
      };

      const simpleImpact = createTestImpactResult([simpleTask]);
      const complexImpact = createTestImpactResult([complexTask]);

      const simpleResult = await scorer.score(simpleImpact);
      const complexResult = await scorer.score(complexImpact);

      expect(complexResult.screenScores[0].taskScores[0].totalScore)
        .toBeGreaterThan(simpleResult.screenScores[0].taskScores[0].totalScore);
    });

    it('should include rationale in score breakdown', async () => {
      const task: Task = {
        id: 'T-001',
        title: '기능 수정',
        type: 'FE',
        actionType: 'modify',
        description: '기능 수정',
        affectedFiles: ['src/comp.tsx'],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      };

      const impact = createTestImpactResult([task]);
      const result = await scorer.score(impact);

      const taskScore = result.screenScores[0].taskScores[0];
      expect(taskScore.scores.developmentComplexity.rationale).toBeTruthy();
      expect(taskScore.scores.impactScope.rationale).toBeTruthy();
      expect(taskScore.scores.policyChange.rationale).toBeTruthy();
      expect(taskScore.scores.dependencyRisk.rationale).toBeTruthy();
    });
  });

  describe('getRecommendation', () => {
    it('should return recommendation for each grade', () => {
      expect(scorer.getRecommendation('Low')).toBeTruthy();
      expect(scorer.getRecommendation('Medium')).toBeTruthy();
      expect(scorer.getRecommendation('High')).toBeTruthy();
      expect(scorer.getRecommendation('Critical')).toBeTruthy();
    });

    it('should return appropriate recommendation for Critical', () => {
      const recommendation = scorer.getRecommendation('Critical');
      expect(recommendation).toContain('아키텍처');
    });
  });

  describe('grade thresholds', () => {
    it('should have correct ranges', () => {
      expect(GRADE_THRESHOLDS.Low.range.min).toBe(0);
      expect(GRADE_THRESHOLDS.Low.range.max).toBe(15);
      expect(GRADE_THRESHOLDS.Medium.range.min).toBe(16);
      expect(GRADE_THRESHOLDS.Medium.range.max).toBe(40);
      expect(GRADE_THRESHOLDS.High.range.min).toBe(41);
      expect(GRADE_THRESHOLDS.High.range.max).toBe(70);
      expect(GRADE_THRESHOLDS.Critical.range.min).toBe(71);
    });
  });
});
