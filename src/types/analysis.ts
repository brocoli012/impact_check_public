/**
 * @module types/analysis
 * @description 분석 결과 타입 정의 - 영향도 분석 파이프라인의 입출력 타입
 */

import { UniqueId, FilePath, ISODateString } from './common';
import { CrossProjectImpact } from '../core/cross-project/types';
import { AnalysisStatus } from '../utils/analysis-status';

// ============================================================
// Step 1: 기획서 파싱 결과 타입
// ============================================================

/** 파싱된 기획서 */
export interface ParsedSpec {
  /** 기획 제목 */
  title: string;
  /** 요구사항 목록 */
  requirements: Requirement[];
  /** 기능 목록 */
  features: Feature[];
  /** 비즈니스 규칙 목록 */
  businessRules: BusinessRule[];
  /** 대상 화면 추정 목록 */
  targetScreens: string[];
  /** 검색 키워드 목록 */
  keywords: string[];
  /** 불명확한 사항 목록 */
  ambiguities: string[];
}

/** 요구사항 */
export interface Requirement {
  /** 요구사항 ID */
  id: string;
  /** 요구사항 이름 */
  name: string;
  /** 요구사항 설명 */
  description: string;
  /** 우선순위 */
  priority: 'must' | 'should' | 'could' | 'wont';
  /** 관련 기능 ID 목록 */
  relatedFeatures: string[];
}

/** 기능 */
export interface Feature {
  /** 기능 ID */
  id: string;
  /** 기능명 */
  name: string;
  /** 기능 설명 */
  description: string;
  /** 대상 화면 추정 */
  targetScreen: string;
  /** 작업 유형 */
  actionType: 'new' | 'modify' | 'config';
  /** 검색 키워드 */
  keywords: string[];
}

/** 비즈니스 규칙 */
export interface BusinessRule {
  /** 규칙 ID */
  id: string;
  /** 규칙 설명 */
  description: string;
  /** 관련 기능 ID 목록 */
  relatedFeatures: string[];
}

// ============================================================
// Step 2: 검색 쿼리 타입
// ============================================================

/** 검색 쿼리 */
export interface SearchQuery {
  /** 검색 키워드 */
  keywords: string[];
  /** 대상 화면명 */
  targetScreen?: string;
  /** 작업 유형 */
  actionType: 'new' | 'modify' | 'config';
  /** 관련 기능 ID */
  featureId: string;
}

// ============================================================
// Step 3: 인덱스 매칭 결과 타입
// ============================================================

/** 매칭된 엔티티 */
export interface MatchedEntities {
  /** 매칭된 화면 목록 */
  screens: MatchedEntity[];
  /** 매칭된 컴포넌트 목록 */
  components: MatchedEntity[];
  /** 매칭된 API 목록 */
  apis: MatchedEntity[];
  /** 매칭된 모델 목록 */
  models: MatchedEntity[];
}

/** 매칭된 개별 엔티티 */
export interface MatchedEntity {
  /** 엔티티 ID */
  id: UniqueId;
  /** 엔티티 이름 */
  name: string;
  /** 매칭 신뢰도 점수 (0.0~1.0) */
  matchScore: number;
  /** 매칭 근거 */
  matchReason: string;
}

// ============================================================
// Step 4: 영향도 분석 결과 타입
// ============================================================

/** 영향도 분석 결과 */
export interface ImpactResult {
  /** 분석 ID */
  analysisId: string;
  /** 분석 시각 */
  analyzedAt: ISODateString;
  /** 기획서 제목 */
  specTitle: string;
  /** 분석 방법 (규칙 기반) */
  analysisMethod: 'rule-based';
  /** 영향 받는 화면 목록 */
  affectedScreens: ScreenImpact[];
  /** 작업 목록 */
  tasks: Task[];
  /** 기획 확인 사항 목록 */
  planningChecks: Check[];
  /** 정책 변경 사항 목록 */
  policyChanges: PolicyChange[];
}

/** 화면별 영향도 */
export interface ScreenImpact {
  /** 화면 ID */
  screenId: UniqueId;
  /** 화면 이름 */
  screenName: string;
  /** 영향도 수준 */
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 이 화면에 대한 작업 목록 */
  tasks: Task[];
}

/** 작업 항목 */
export interface Task {
  /** 작업 ID */
  id: string;
  /** 작업 제목 */
  title: string;
  /** 작업 유형 (FE/BE) */
  type: 'FE' | 'BE';
  /** 작업 분류 */
  actionType: 'new' | 'modify' | 'config';
  /** 작업 설명 */
  description: string;
  /** 영향 받는 파일 목록 */
  affectedFiles: FilePath[];
  /** 관련 API 목록 */
  relatedApis: UniqueId[];
  /** 기획 확인 사항 */
  planningChecks: string[];
  /** 분석 근거 */
  rationale: string;
  /** 출처 요구사항 ID 목록 (REQ-009: 트레이서빌리티) */
  sourceRequirementIds?: string[];
  /** 출처 기능 ID 목록 (REQ-009: 트레이서빌리티) */
  sourceFeatureIds?: string[];
}

/** 기획 확인 사항 */
export interface Check {
  /** 확인 사항 ID */
  id: string;
  /** 확인 내용 */
  content: string;
  /** 관련 기능 ID */
  relatedFeatureId: string;
  /** 중요도 */
  priority: 'high' | 'medium' | 'low';
  /** 확인 상태 */
  status: 'pending' | 'confirmed' | 'rejected';
}

/** 정책 변경 사항 */
export interface PolicyChange {
  /** 변경 사항 ID */
  id: string;
  /** 정책명 */
  policyName: string;
  /** 변경 설명 */
  description: string;
  /** 변경 유형 */
  changeType: 'new' | 'modify' | 'remove';
  /** 관련 파일 */
  affectedFiles: FilePath[];
  /** 확인 필요 여부 */
  requiresReview: boolean;
}

// ============================================================
// Step 5: 점수 산출 결과 타입
// ============================================================

/** 점수 산출 결과 */
export interface ScoredResult extends ImpactResult {
  /** 화면별 점수 */
  screenScores: ScreenScore[];
  /** 종합 점수 */
  totalScore: number;
  /** 종합 등급 */
  grade: 'Low' | 'Medium' | 'High' | 'Critical';
  /** 권장 사항 */
  recommendation: string;
}

/** 화면별 점수 */
export interface ScreenScore {
  /** 화면 ID */
  screenId: UniqueId;
  /** 화면 이름 */
  screenName: string;
  /** 화면 종합 점수 */
  screenScore: number;
  /** 화면 등급 */
  grade: 'Low' | 'Medium' | 'High' | 'Critical';
  /** 작업별 점수 목록 */
  taskScores: TaskScore[];
}

/** 작업별 점수 */
export interface TaskScore {
  /** 작업 ID */
  taskId: string;
  /** 점수 분해 */
  scores: import('./scoring').ScoreBreakdown;
  /** 종합 점수 */
  totalScore: number;
  /** 등급 */
  grade: 'Low' | 'Medium' | 'High' | 'Critical';
}

// ============================================================
// Step 5.5: 정책 매칭 + 담당자 매핑 보강 결과 타입
// ============================================================

/** 정책 매칭 + 담당자 매핑 보강 결과 */
export interface EnrichedResult extends ScoredResult {
  /** 정책 경고 목록 */
  policyWarnings: PolicyWarning[];
  /** 담당자 알림 목록 */
  ownerNotifications: OwnerNotification[];
}

/** 정책 경고 */
export interface PolicyWarning {
  /** 경고 ID */
  id: string;
  /** 관련 정책 ID */
  policyId: UniqueId;
  /** 정책명 */
  policyName: string;
  /** 경고 메시지 */
  message: string;
  /** 심각도 */
  severity: 'info' | 'warning' | 'critical';
  /** 관련 작업 ID 목록 */
  relatedTaskIds: string[];
}

/** 담당자 알림 */
export interface OwnerNotification {
  /** 알림 ID */
  id: string;
  /** 시스템 ID */
  systemId: string;
  /** 시스템명 */
  systemName: string;
  /** 담당 팀 */
  team: string;
  /** 담당자 이름 */
  ownerName: string;
  /** 담당자 이메일 */
  ownerEmail: string;
  /** 슬랙 채널 */
  slackChannel?: string;
  /** 관련 작업 ID 목록 */
  relatedTaskIds: string[];
  /** 확인 요청 메일 초안 */
  emailDraft: string;
}

// ============================================================
// Step 5.7: 신뢰도 보강 결과 타입
// ============================================================

/** 신뢰도 보강 결과 */
export interface ConfidenceEnrichedResult extends EnrichedResult {
  /** 시스템별 신뢰도 점수 */
  confidenceScores: SystemConfidence[];
  /** 낮은 신뢰도 경고 목록 */
  lowConfidenceWarnings: ConfidenceWarning[];
  /** 크로스 프로젝트 영향도 (optional) */
  crossProjectImpact?: CrossProjectImpact;
  /** 파싱된 기획서 원본 (REQ-009: 트레이서빌리티) */
  parsedSpec?: ParsedSpec;
  /** 분석 요약 (REQ-009) */
  analysisSummary?: AnalysisSummary;
  /** 분석 상태 */
  status?: AnalysisStatus;
  /** 상태 변경 시각 */
  statusChangedAt?: string;
  /** 보완 분석 원본 분석 ID */
  supplementOf?: string;
  /** 보완 분석 트리거 프로젝트 ID */
  triggerProject?: string;
}

/** 시스템별 신뢰도 */
export interface SystemConfidence {
  /** 시스템 ID */
  systemId: string;
  /** 시스템명 */
  systemName: string;
  /** 전체 점수 (0~100) */
  overallScore: number;
  /** 신뢰도 등급 */
  grade: 'high' | 'medium' | 'low' | 'very_low';
  /** Layer별 점수 */
  layers: import('./scoring').LayerScore;
  /** 경고 사항 */
  warnings: string[];
  /** 보완 권장 사항 */
  recommendations: string[];
}

/** 신뢰도 경고 */
export interface ConfidenceWarning {
  /** 시스템 ID */
  systemId: string;
  /** 시스템명 */
  systemName: string;
  /** 신뢰도 점수 */
  confidenceScore: number;
  /** 신뢰도 등급 */
  grade: 'high' | 'medium' | 'low' | 'very_low';
  /** 경고 사유 */
  reason: string;
  /** 조치 안내 */
  action: string;
}

// ============================================================
// 분석 요약 타입 (REQ-009)
// ============================================================

/** 분석 요약 */
export interface AnalysisSummary {
  /** 개요 */
  overview: string;
  /** 주요 발견 사항 */
  keyFindings: string[];
  /** 위험 영역 */
  riskAreas: string[];
}
