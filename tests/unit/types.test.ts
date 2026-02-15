/**
 * @module tests/unit/types
 * @description 타입 정의 컴파일 검증 테스트
 *
 * 이 테스트는 모든 타입이 올바르게 정의되고 컴파일되는지 검증합니다.
 */

import {
  ProjectsConfig,
  ProjectEntry,
  IndexMeta,
  ScreenInfo,
  ComponentInfo,
  ApiEndpoint,
  ModelInfo,
  DependencyGraph,
  PolicyInfo,
  FileInfo,
  CodeIndex,
} from '../../src/types/index';

import {
  ParsedSpec,
  Requirement,
  Feature,
  BusinessRule,
  SearchQuery,
  MatchedEntities,
  ImpactResult,
  ScreenImpact,
  Task,
  Check,
  PolicyChange,
  ScoredResult,
  ScreenScore,
  EnrichedResult,
  PolicyWarning,
  OwnerNotification,
  ConfidenceEnrichedResult,
  SystemConfidence,
  ConfidenceWarning,
} from '../../src/types/analysis';

import {
  ScoreDimension,
  ScoreBreakdown,
  GradeInfo,
  Grade,
  GRADE_THRESHOLDS,
  SCORE_WEIGHTS,
  ConfidenceScore,
  LayerScore,
  CONFIDENCE_WEIGHTS,
} from '../../src/types/scoring';

import {
  AnnotationFile,
  FunctionAnnotation,
  InferredPolicy,
  PolicyCondition,
  PolicyVariable,
  PolicyConstant,
  PolicyConstraint,
  PolicyDataSource,
  PolicyDependency,
  PolicyImpactScope,
  PolicyReviewItem,
  PolicyReference,
  AnnotationMeta,
} from '../../src/types/annotations';

import {
  AppConfig,
  LLMProviderConfig,
  OwnersConfig,
  SystemOwner,
  DEFAULT_CONFIG,
} from '../../src/types/config';

import {
  LLMProvider,
  LLMOptions,
  LLMResponse,
  LLMTask,
  Message,
} from '../../src/types/llm';

import {
  ResultCode,
  LogLevel,
  Command,
  CommandResult,
} from '../../src/types/common';

describe('Type Definitions Compilation', () => {
  describe('types/common', () => {
    it('should define ResultCode enum', () => {
      expect(ResultCode.SUCCESS).toBe('SUCCESS');
      expect(ResultCode.FAILURE).toBe('FAILURE');
      expect(ResultCode.PARTIAL).toBe('PARTIAL');
      expect(ResultCode.CANCELLED).toBe('CANCELLED');
      expect(ResultCode.NEEDS_CONFIG).toBe('NEEDS_CONFIG');
      expect(ResultCode.NEEDS_INDEX).toBe('NEEDS_INDEX');
    });

    it('should define LogLevel enum', () => {
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
      expect(LogLevel.FATAL).toBe('fatal');
    });

    it('should compile CommandResult type', () => {
      const result: CommandResult = {
        code: ResultCode.SUCCESS,
        message: 'Test',
      };
      expect(result.code).toBe(ResultCode.SUCCESS);
    });
  });

  describe('types/index', () => {
    it('should compile ProjectsConfig type', () => {
      const config: ProjectsConfig = {
        activeProject: 'test-project',
        projects: [],
      };
      expect(config.activeProject).toBe('test-project');
    });

    it('should compile ProjectEntry type', () => {
      const entry: ProjectEntry = {
        id: 'test',
        name: 'Test Project',
        path: '/path/to/project',
        status: 'active',
        createdAt: '2026-02-14T00:00:00Z',
        lastUsedAt: '2026-02-14T00:00:00Z',
        techStack: ['react', 'typescript'],
      };
      expect(entry.id).toBe('test');
      expect(entry.status).toBe('active');
    });

    it('should compile IndexMeta type', () => {
      const meta: IndexMeta = {
        version: 1,
        createdAt: '2026-02-14T00:00:00Z',
        updatedAt: '2026-02-14T00:00:00Z',
        gitCommit: 'abc1234',
        gitBranch: 'main',
        project: {
          name: 'test',
          path: '/path',
          techStack: ['react'],
          packageManager: 'npm',
        },
        stats: {
          totalFiles: 100,
          screens: 10,
          components: 50,
          apiEndpoints: 20,
          models: 5,
          modules: 15,
        },
      };
      expect(meta.version).toBe(1);
    });

    it('should compile ScreenInfo type', () => {
      const screen: ScreenInfo = {
        id: 'screen-001',
        name: 'Test Screen',
        route: '/test',
        filePath: 'src/views/Test.vue',
        components: ['comp-001'],
        apiCalls: ['api-001'],
        childScreens: [],
        metadata: {
          linesOfCode: 100,
          complexity: 'medium',
        },
      };
      expect(screen.id).toBe('screen-001');
    });

    it('should compile ComponentInfo type', () => {
      const comp: ComponentInfo = {
        id: 'comp-001',
        name: 'TestComponent',
        filePath: 'src/components/Test.vue',
        type: 'vue-component',
        imports: [],
        importedBy: ['screen-001'],
        props: ['id'],
        emits: ['update'],
        apiCalls: [],
        linesOfCode: 50,
      };
      expect(comp.name).toBe('TestComponent');
    });

    it('should compile ApiEndpoint type', () => {
      const api: ApiEndpoint = {
        id: 'api-001',
        method: 'GET',
        path: '/api/test',
        filePath: 'src/api/test.ts',
        handler: 'getTest',
        calledBy: ['comp-001'],
        requestParams: ['id'],
        responseType: 'TestResponse',
        relatedModels: ['model-001'],
      };
      expect(api.method).toBe('GET');
    });

    it('should compile DependencyGraph type', () => {
      const graph: DependencyGraph = {
        graph: {
          nodes: [{ id: 'n1', type: 'component', name: 'Test' }],
          edges: [{ from: 'n1', to: 'n2', type: 'import' }],
        },
      };
      expect(graph.graph.nodes.length).toBe(1);
    });

    it('should compile PolicyInfo type', () => {
      const policy: PolicyInfo = {
        id: 'policy-001',
        name: 'Test Policy',
        description: 'Test',
        source: 'comment',
        sourceText: '// Policy: Test',
        filePath: 'src/test.ts',
        lineNumber: 10,
        category: 'test',
        relatedComponents: [],
        relatedApis: [],
        relatedModules: [],
        extractedAt: '2026-02-14T00:00:00Z',
      };
      expect(policy.source).toBe('comment');
    });

    it('should compile FileInfo type', () => {
      const file: FileInfo = {
        path: 'src/test.ts',
        hash: 'abc123',
        size: 1024,
        extension: '.ts',
        lastModified: '2026-02-14T00:00:00Z',
      };
      expect(file.extension).toBe('.ts');
    });
  });

  describe('types/analysis', () => {
    it('should compile ParsedSpec type', () => {
      const spec: ParsedSpec = {
        title: 'Test Spec',
        requirements: [],
        features: [],
        businessRules: [],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };
      expect(spec.title).toBe('Test Spec');
    });

    it('should compile Requirement type', () => {
      const req: Requirement = {
        id: 'R-001',
        name: 'Test Requirement',
        description: 'Test',
        priority: 'must',
        relatedFeatures: ['F-001'],
      };
      expect(req.priority).toBe('must');
    });

    it('should compile Feature type', () => {
      const feature: Feature = {
        id: 'F-001',
        name: 'Test Feature',
        description: 'Test',
        targetScreen: 'screen-001',
        actionType: 'new',
        keywords: ['test'],
      };
      expect(feature.actionType).toBe('new');
    });

    it('should compile ImpactResult type', () => {
      const result: ImpactResult = {
        analysisId: 'a1',
        analyzedAt: '2026-02-14T00:00:00Z',
        specTitle: 'Test',
        affectedScreens: [],
        tasks: [],
        planningChecks: [],
        policyChanges: [],
      };
      expect(result.analysisId).toBe('a1');
    });

    it('should compile Task type', () => {
      const task: Task = {
        id: 'T-001',
        title: 'Test Task',
        type: 'FE',
        actionType: 'new',
        description: 'Test description',
        affectedFiles: ['src/test.ts'],
        relatedApis: ['api-001'],
        planningChecks: ['Check item'],
        rationale: 'Because of this and that',
      };
      expect(task.type).toBe('FE');
    });

    it('should compile ConfidenceEnrichedResult extends EnrichedResult', () => {
      // Verify type hierarchy compiles correctly
      const warning: ConfidenceWarning = {
        systemId: 'sys-1',
        systemName: 'Test System',
        confidenceScore: 45,
        grade: 'low',
        reason: 'Low annotation coverage',
        action: '/impact annotations generate',
      };
      expect(warning.grade).toBe('low');
    });
  });

  describe('types/scoring', () => {
    it('should define GRADE_THRESHOLDS', () => {
      expect(GRADE_THRESHOLDS.Low.range.min).toBe(0);
      expect(GRADE_THRESHOLDS.Low.range.max).toBe(15);
      expect(GRADE_THRESHOLDS.Medium.range.min).toBe(16);
      expect(GRADE_THRESHOLDS.Critical.range.min).toBe(71);
    });

    it('should define SCORE_WEIGHTS', () => {
      expect(SCORE_WEIGHTS.developmentComplexity).toBe(0.35);
      expect(SCORE_WEIGHTS.impactScope).toBe(0.30);
      expect(SCORE_WEIGHTS.policyChange).toBe(0.20);
      expect(SCORE_WEIGHTS.dependencyRisk).toBe(0.15);
      // Weights should sum to 1.0
      const totalWeight = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBeCloseTo(1.0);
    });

    it('should define CONFIDENCE_WEIGHTS', () => {
      expect(CONFIDENCE_WEIGHTS.layer1Structure).toBe(0.25);
      expect(CONFIDENCE_WEIGHTS.layer2Dependency).toBe(0.25);
      expect(CONFIDENCE_WEIGHTS.layer3Policy).toBe(0.20);
      expect(CONFIDENCE_WEIGHTS.layer4LLM).toBe(0.30);
      const totalWeight = Object.values(CONFIDENCE_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBeCloseTo(1.0);
    });

    it('should compile ScoreBreakdown type', () => {
      const breakdown: ScoreBreakdown = {
        developmentComplexity: { score: 5, weight: 0.35, rationale: 'Test' },
        impactScope: { score: 3, weight: 0.30, rationale: 'Test' },
        policyChange: { score: 2, weight: 0.20, rationale: 'Test' },
        dependencyRisk: { score: 1, weight: 0.15, rationale: 'Test' },
      };
      expect(breakdown.developmentComplexity.score).toBe(5);
    });

    it('should compile Grade type with all valid values', () => {
      const grades: Grade[] = ['Low', 'Medium', 'High', 'Critical'];
      expect(grades.length).toBe(4);
    });
  });

  describe('types/annotations', () => {
    it('should compile AnnotationFile type', () => {
      const file: AnnotationFile = {
        file: 'src/test.ts',
        system: 'test-system',
        lastAnalyzed: '2026-02-14T00:00:00Z',
        sourceHash: 'abc123',
        analyzerVersion: '1.0.0',
        llmModel: 'claude-sonnet-4',
        fileSummary: {
          description: 'Test file',
          confidence: 0.85,
          businessDomain: 'test',
          keywords: ['test'],
        },
        annotations: [],
      };
      expect(file.system).toBe('test-system');
    });

    it('should compile InferredPolicy with optional extension fields', () => {
      const policy: InferredPolicy = {
        name: 'Test Policy',
        description: 'Test description',
        confidence: 0.9,
        category: 'test',
        inferred_from: 'code analysis',
        // Optional fields
        conditions: [
          {
            order: 1,
            type: 'if',
            condition: 'user is premium',
            conditionCode: 'user.isPremium',
            result: 'free shipping',
            resultValue: 'shippingFee = 0',
          },
        ],
        constants: [
          {
            name: 'MAX_ITEMS',
            value: '100',
            type: 'number',
            description: 'Maximum items',
            source: 'hardcoded',
            codeLocation: 'src/constants.ts:5',
          },
        ],
        reviewItems: [
          {
            priority: 'high',
            category: 'value_check',
            question: 'Is MAX_ITEMS correct?',
            context: 'Hardcoded value',
            relatedConstraint: null,
          },
        ],
      };
      expect(policy.conditions?.length).toBe(1);
      expect(policy.constants?.length).toBe(1);
      expect(policy.reviewItems?.length).toBe(1);
    });

    it('should compile AnnotationMeta type', () => {
      const meta: AnnotationMeta = {
        version: '1.0.0',
        createdAt: '2026-02-14T00:00:00Z',
        lastUpdatedAt: '2026-02-14T00:00:00Z',
        totalFiles: 10,
        totalAnnotations: 50,
        totalPolicies: 15,
        systems: {
          'delivery': { files: 5, annotations: 25, policies: 8 },
        },
        avgConfidence: 0.78,
        lowConfidenceCount: 3,
        userModifiedCount: 2,
      };
      expect(meta.totalFiles).toBe(10);
    });
  });

  describe('types/config', () => {
    it('should define DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG.version).toBe(1);
      expect(DEFAULT_CONFIG.llm.defaultProvider).toBe('anthropic');
      expect(DEFAULT_CONFIG.general.webPort).toBe(3847);
    });

    it('should compile AppConfig type', () => {
      const config: AppConfig = { ...DEFAULT_CONFIG };
      expect(config.llm.routing['spec-parsing']).toBe('openai');
      expect(config.llm.routing['impact-analysis']).toBe('anthropic');
    });

    it('should compile SystemOwner type', () => {
      const owner: SystemOwner = {
        systemName: 'Test System',
        systemId: 'test-system',
        team: 'Test Team',
        owner: {
          name: 'John',
          email: 'john@example.com',
          slackChannel: '#test',
        },
        scope: 'Test scope',
        relatedPaths: ['src/test/'],
        updatedAt: '2026-02-14T00:00:00Z',
      };
      expect(owner.systemId).toBe('test-system');
    });
  });

  describe('types/llm', () => {
    it('should compile Message type', () => {
      const msg: Message = {
        role: 'user',
        content: 'Hello',
      };
      expect(msg.role).toBe('user');
    });

    it('should compile LLMOptions type', () => {
      const options: LLMOptions = {
        model: 'claude-sonnet-4',
        maxTokens: 4096,
        temperature: 0,
        responseFormat: 'json',
      };
      expect(options.model).toBe('claude-sonnet-4');
    });

    it('should compile LLMResponse type', () => {
      const response: LLMResponse = {
        content: 'Test response',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          estimatedCost: 0.01,
        },
        model: 'claude-sonnet-4',
        provider: 'anthropic',
      };
      expect(response.provider).toBe('anthropic');
    });

    it('should compile LLMTask type with all valid values', () => {
      const tasks: LLMTask[] = [
        'spec-parsing',
        'impact-analysis',
        'score-calculation',
        'multimodal-parsing',
        'general',
      ];
      expect(tasks.length).toBe(5);
    });
  });
});

// Suppress unused import warnings by using all imported types in type assertions
// These verify the types are importable and correctly defined
void (null as unknown as ModelInfo);
void (null as unknown as CodeIndex);
void (null as unknown as SearchQuery);
void (null as unknown as MatchedEntities);
void (null as unknown as ScreenImpact);
void (null as unknown as Check);
void (null as unknown as PolicyChange);
void (null as unknown as ScoredResult);
void (null as unknown as ScreenScore);
void (null as unknown as EnrichedResult);
void (null as unknown as PolicyWarning);
void (null as unknown as OwnerNotification);
void (null as unknown as ConfidenceEnrichedResult);
void (null as unknown as SystemConfidence);
void (null as unknown as ScoreDimension);
void (null as unknown as GradeInfo);
void (null as unknown as ConfidenceScore);
void (null as unknown as LayerScore);
void (null as unknown as FunctionAnnotation);
void (null as unknown as PolicyCondition);
void (null as unknown as PolicyVariable);
void (null as unknown as PolicyConstant);
void (null as unknown as PolicyConstraint);
void (null as unknown as PolicyDataSource);
void (null as unknown as PolicyDependency);
void (null as unknown as PolicyImpactScope);
void (null as unknown as PolicyReviewItem);
void (null as unknown as PolicyReference);
void (null as unknown as LLMProviderConfig);
void (null as unknown as OwnersConfig);
void (null as unknown as LLMProvider);
void (null as unknown as BusinessRule);
void (null as unknown as Command);
void (null as unknown as CommandResult);
