/**
 * @module web/components/flowchart/types
 * @description 플로우차트 노드 데이터 타입 정의
 */

import type { Grade, ConfidenceGrade, TaskType, ActionType } from '../../types';

/** 요구사항 노드 데이터 */
export interface RequirementNodeData {
  label: string;
  affectedSystemCount: number;
  totalScore: number;
  grade: Grade;
  [key: string]: unknown;
}

/** 시스템 노드 데이터 */
export interface SystemNodeData {
  label: string;
  totalScore: number;
  grade: Grade;
  confidence: ConfidenceGrade;
  [key: string]: unknown;
}

/** 화면 노드 데이터 */
export interface ScreenNodeData {
  label: string;
  score: number;
  grade: Grade;
  feCount: number;
  beCount: number;
  hasChildren: boolean;
  expanded: boolean;
  [key: string]: unknown;
}

/** 기능 노드 데이터 */
export interface FeatureNodeData {
  label: string;
  workType: ActionType;
  score: number;
  grade: Grade;
  taskType: TaskType;
  [key: string]: unknown;
}

/** 모듈 노드 데이터 */
export interface ModuleNodeData {
  label: string;
  taskType: TaskType;
  score: number;
  filePath: string;
  [key: string]: unknown;
}

/** 기획 확인 노드 데이터 */
export interface CheckNodeData {
  label: string;
  urgency: 'high' | 'medium' | 'low';
  [key: string]: unknown;
}

/** 정책 변경 노드 데이터 */
export interface PolicyNodeData {
  label: string;
  description: string;
  requiresReview: boolean;
  [key: string]: unknown;
}

/** 정책 경고 노드 데이터 */
export interface PolicyWarningNodeData {
  label: string;
  policyName: string;
  severity: 'info' | 'warning' | 'critical';
  relatedSystem: string;
  [key: string]: unknown;
}

/** 엔티티(테이블) 노드 데이터 */
export interface EntityNodeData {
  label: string;
  projects: string[];
  fieldCount?: number;
  isShared: boolean;
  [key: string]: unknown;
}

/** 이벤트 노드 데이터 */
export interface EventNodeData {
  label: string;
  publishers: string[];
  subscribers: string[];
  [key: string]: unknown;
}

/** 모든 노드 데이터 유니온 */
export type FlowNodeData =
  | RequirementNodeData
  | SystemNodeData
  | ScreenNodeData
  | FeatureNodeData
  | ModuleNodeData
  | CheckNodeData
  | PolicyNodeData
  | PolicyWarningNodeData
  | EntityNodeData
  | EventNodeData;

/** 엣지 유형 */
export type EdgeType = 'normal' | 'strong' | 'weak';

/** 커스텀 엣지 데이터 */
export interface CustomEdgeData {
  edgeType: EdgeType;
  sourceGrade?: Grade;
  [key: string]: unknown;
}
