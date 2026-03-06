/**
 * @module web/types
 * @description Web SPA 공유 타입 정의
 */

/** 분석 결과 상태 타입 (REQ-015-S) */
export type AnalysisStatus = 'active' | 'completed' | 'on-hold' | 'archived';

/** 등급 타입 */
export type Grade = 'Low' | 'Medium' | 'High' | 'Critical';

/** 신뢰도 등급 타입 */
export type ConfidenceGrade = 'high' | 'medium' | 'low' | 'very_low';

/** 작업 유형 */
export type TaskType = 'FE' | 'BE';

/** 작업 분류 */
export type ActionType = 'new' | 'modify' | 'config';

/** 영향도 수준 */
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

/** 화면별 점수 */
export interface ScreenScore {
  screenId: string;
  screenName: string;
  screenScore: number;
  grade: Grade;
  taskScores: TaskScore[];
}

/** 작업별 점수 */
export interface TaskScore {
  taskId: string;
  scores: ScoreBreakdown;
  totalScore: number;
  grade: Grade;
}

/** 점수 분해 */
export interface ScoreBreakdown {
  developmentComplexity: ScoreDimension;
  impactScope: ScoreDimension;
  policyChange: ScoreDimension;
  dependencyRisk: ScoreDimension;
}

/** 점수 차원 */
export interface ScoreDimension {
  score: number;
  weight: number;
  rationale: string;
}

/** 화면 영향도 */
export interface ScreenImpact {
  screenId: string;
  screenName: string;
  impactLevel: ImpactLevel;
  tasks: Task[];
}

/** 작업 항목 */
export interface Task {
  id: string;
  title: string;
  type: TaskType;
  actionType: ActionType;
  description: string;
  affectedFiles: string[];
  relatedApis: string[];
  planningChecks: string[];
  rationale: string;
  /** 출처 요구사항 ID 목록 (REQ-009: 트레이서빌리티) */
  sourceRequirementIds?: string[];
  /** 출처 기능 ID 목록 (REQ-009: 트레이서빌리티) */
  sourceFeatureIds?: string[];
}

/** 기획 확인 사항 */
export interface Check {
  id: string;
  content: string;
  relatedFeatureId: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'confirmed' | 'rejected';
}

/** 정책 경고 */
export interface PolicyWarning {
  id: string;
  policyId: string;
  policyName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  relatedTaskIds: string[];
}

/** 담당자 알림 */
export interface OwnerNotification {
  id: string;
  systemId: string;
  systemName: string;
  team: string;
  ownerName: string;
  ownerEmail: string;
  slackChannel?: string;
  relatedTaskIds: string[];
  emailDraft: string;
}

/** 분석 결과 (서버에서 받는 전체 결과) */
export interface AnalysisResult {
  analysisId: string;
  analyzedAt: string;
  specTitle: string;
  analysisMethod: 'rule-based';
  affectedScreens: ScreenImpact[];
  tasks: Task[];
  planningChecks: Check[];
  policyChanges: PolicyChange[];
  screenScores: ScreenScore[];
  totalScore: number;
  grade: Grade;
  recommendation: string;
  policyWarnings: PolicyWarning[];
  ownerNotifications: OwnerNotification[];
  confidenceScores: SystemConfidence[];
  lowConfidenceWarnings: ConfidenceWarning[];
  /** 파싱된 기획서 원본 (REQ-009: 트레이서빌리티) */
  parsedSpec?: WebParsedSpec;
  /** 분석 요약 (REQ-009) */
  analysisSummary?: AnalysisSummary;
}

/** 정책 변경 */
export interface PolicyChange {
  id: string;
  policyName: string;
  description: string;
  changeType: 'new' | 'modify' | 'remove';
  affectedFiles: string[];
  requiresReview: boolean;
}

/** 시스템 신뢰도 */
export interface SystemConfidence {
  systemId: string;
  systemName: string;
  overallScore: number;
  grade: ConfidenceGrade;
  warnings: string[];
  recommendations: string[];
}

/** 신뢰도 경고 */
export interface ConfidenceWarning {
  systemId: string;
  systemName: string;
  confidenceScore: number;
  grade: ConfidenceGrade;
  reason: string;
  action: string;
}

/** 결과 요약 (목록 조회용) */
export interface ResultSummary {
  id: string;
  specTitle: string;
  analyzedAt: string;
  totalScore: number;
  grade: string;
  affectedScreenCount: number;
  taskCount: number;
  /** 데모/목업 데이터 여부 */
  isDemo?: boolean;
  /** 분석 상태 (없으면 'active'로 간주 - Lazy Migration) */
  status?: AnalysisStatus;
  /** 상태 변경 시각 */
  statusChangedAt?: string;
  /** 보완 분석 여부 */
  isSupplement?: boolean;
  /** 보완 분석 원본 분석 ID */
  supplementOf?: string;
  /** 보완 분석 트리거 프로젝트 */
  triggerProject?: string;
}

/** 체크리스트 항목 */
export interface ChecklistItem {
  itemId: string;
  checked: boolean;
  updatedAt: string;
}

/** 체크리스트 데이터 */
export interface ChecklistData {
  resultId: string;
  items: ChecklistItem[];
}

/** 정책 대상 Audience */
export type PolicyAudience = 'planner' | 'developer' | 'both';

/** 정책 (Policy) - 인덱싱된 정책 규칙 */
export interface Policy {
  id: string;
  name: string;
  category: string;
  description: string;
  confidence: number;
  affectedFiles: string[];
  relatedTaskIds: string[];
  source: string;
  audience?: PolicyAudience;
  plannerDescription?: string;
  developerDescription?: string;
  relatedScreen?: string;
  relatedFunction?: string;
}

/** 정책 상세 (Policy Detail) */
export interface PolicyDetail extends Policy {
  rules: PolicyRule[];
  changeHistory: PolicyChangeHistory[];
  relatedPolicies: string[];
  /** 보강 주석 데이터 (annotation API 응답에서 합산) */
  annotation?: PolicyAnnotation | null;
}

/** 보강 주석 데이터 */
export interface PolicyAnnotation {
  file: string;
  system: string;
  lastAnalyzed: string;
  fileSummary: {
    description: string;
    confidence: number;
    businessDomain: string;
    keywords: string[];
  };
  annotations: PolicyFunctionAnnotation[];
}

/** 함수별 보강 주석 */
export interface PolicyFunctionAnnotation {
  function: string;
  signature: string;
  enriched_comment: string;
  confidence: number;
  type: string;
  policies: InferredPolicyDetail[];
  relatedFunctions: string[];
  relatedApis: string[];
}

/** 추론된 정책 상세 (보강 주석에서 추출) */
export interface InferredPolicyDetail {
  name: string;
  description: string;
  confidence: number;
  category: string;
  inferred_from: string;
  conditions?: PolicyCondition[];
  defaultResult?: string;
  exceptionHandling?: string | null;
  inputVariables?: PolicyVariable[];
  outputVariables?: PolicyVariable[];
  constants?: PolicyConstant[];
  internalVariables?: PolicyVariable[];
  constraints?: PolicyConstraint[];
  dataSources?: PolicyDataSource[];
  reviewItems?: PolicyReviewItem[];
}

/** 조건 분기 항목 */
export interface PolicyCondition {
  order: number;
  type: 'if' | 'else_if' | 'else';
  condition: string;
  conditionCode: string;
  result: string;
  resultValue: string;
}

/** 변수 정보 */
export interface PolicyVariable {
  name: string;
  type: string;
  description: string;
}

/** 상수값 정보 */
export interface PolicyConstant {
  name: string;
  value: string;
  type: string;
  description: string;
  source: 'hardcoded' | 'config_file' | 'env_variable' | 'db_query' | 'api_call';
  codeLocation: string;
}

/** 제약사항 */
export interface PolicyConstraint {
  severity: 'warning' | 'info' | 'critical';
  type: string;
  description: string;
  recommendation: string;
  relatedCode: string;
}

/** 데이터 출처 */
export interface PolicyDataSource {
  variableName: string;
  sourceType: string;
  sourceDetail: string;
  description: string;
}

/** 기획자 확인 항목 */
export interface PolicyReviewItem {
  priority: 'high' | 'medium' | 'low';
  category: string;
  question: string;
  context: string;
  relatedConstraint: string | null;
}

/** 정책 규칙 */
export interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

/** 정책 변경 이력 */
export interface PolicyChangeHistory {
  date: string;
  changeType: 'new' | 'modify' | 'remove';
  description: string;
}

/** API 응답 래퍼 */
export interface ApiResponse<T> {
  result?: T;
  results?: T[];
  checklist?: ChecklistData;
  error?: string;
  message?: string;
}

// ============================================================
// REQ-009: 기획서 파싱 결과 타입 (웹 표시용)
// ============================================================

/** 기획서 파싱 결과 (웹 표시용) */
export interface WebParsedSpec {
  title?: string;
  requirements: WebRequirement[];
  features: WebFeature[];
  businessRules: WebBusinessRule[];
  targetScreens?: string[];
  keywords?: string[];
  ambiguities: string[];
}

/** 요구사항 (웹 표시용) */
export interface WebRequirement {
  id: string;
  name: string;
  description: string;
  priority: string;
  relatedFeatures: string[];
}

/** 기능 (웹 표시용) */
export interface WebFeature {
  id: string;
  name: string;
  description: string;
  targetScreen: string;
  actionType: string;
  keywords: string[];
}

/** 비즈니스 규칙 (웹 표시용) */
export interface WebBusinessRule {
  id: string;
  description: string;
  relatedFeatures: string[];
}

/** 분석 요약 */
export interface AnalysisSummary {
  overview: string;
  keyFindings: string[];
  riskAreas: string[];
  /** 현재 시스템의 문제점 목록 */
  currentProblems?: string[];
  /** 기획서 적용 전후 데이터 흐름 변경 */
  dataFlowChanges?: DataFlowChange[];
  /** 사용자 이용 프로세스 변경 */
  processChanges?: ProcessChange[];
}

/** 데이터 흐름 변경 */
export interface DataFlowChange {
  area: string;
  before: string;
  after: string;
  description: string;
}

/** 프로세스 변경 */
export interface ProcessChange {
  processName: string;
  before: string[];
  after: string[];
  changedSteps: number[];
}

// ============================================================
// REQ-012: 멀티 프로젝트 타입
// ============================================================

// ============================================================
// REQ-015: Gap Detection 타입
// ============================================================

/** 갭 심각도 */
export type GapSeverity = 'high' | 'medium' | 'low';

/** 갭 유형 */
export type GapType = 'stale-link' | 'unanalyzed-project' | 'low-confidence' | 'stale-index';

/** 갭 항목 */
export interface GapItem {
  type: GapType;
  severity: GapSeverity;
  projectId: string;
  description: string;
  detail: Record<string, unknown>;
  fixable: boolean;
  fixCommand?: string;
}

/** 갭 탐지 결과 */
export interface GapCheckResult {
  gaps: GapItem[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    fixable: number;
  };
  excludedCounts?: {
    completed: number;
    onHold: number;
    archived: number;
  };
  checkedAt: string;
}

/** 프로젝트 정보 (GET /api/projects 응답 항목) */
export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'archived';
  createdAt: string;
  lastUsedAt: string;
  techStack: string[];
  resultCount: number;
  latestGrade: Grade | null;
  latestScore: number | null;
  latestAnalyzedAt: string | null;
  taskCount: number;
  policyWarningCount: number;
  /** 비즈니스 도메인 키워드 목록 */
  domains?: string[];
  /** 주요 기능 요약 목록 */
  featureSummary?: string[];
  /** 요약 데이터 출처 */
  summarySource?: 'auto' | 'manual' | 'mixed';
  /** 메모/노트 목록 */
  notes?: string[];
}
