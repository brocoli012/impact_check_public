/**
 * @module web/types
 * @description Web SPA 공유 타입 정의
 */

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

/** API 응답 래퍼 */
export interface ApiResponse<T> {
  result?: T;
  results?: T[];
  checklist?: ChecklistData;
  error?: string;
  message?: string;
}
