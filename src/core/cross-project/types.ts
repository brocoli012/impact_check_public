/**
 * @module core/cross-project/types
 * @description 크로스 프로젝트 타입 정의 - 프로젝트 간 의존성 관리 스키마
 */

// ============================================================
// 크로스 프로젝트 설정 타입
// ============================================================

/** 크로스 프로젝트 설정 (cross-project.json 스키마) */
export interface CrossProjectConfig {
  /** 설정 버전 */
  version: number;
  /** 프로젝트 간 의존성 링크 목록 */
  links: ProjectLink[];
  /** 프로젝트 그룹 목록 */
  groups: ProjectGroup[];
}

/** 프로젝트 간 의존성 링크 */
export interface ProjectLink {
  /** 링크 고유 ID */
  id: string;
  /** 소스 프로젝트 ID */
  source: string;
  /** 대상 프로젝트 ID */
  target: string;
  /** 의존성 유형 */
  type: LinkType;
  /** 관련 API 경로 목록 */
  apis?: string[];
  /** 자동 감지 여부 */
  autoDetected: boolean;
  /** 확인 시각 */
  confirmedAt?: string;
}

/** 의존성 유형 */
export type LinkType =
  | 'api-consumer'
  | 'api-provider'
  | 'shared-library'
  | 'shared-types'
  | 'event-publisher'
  | 'event-subscriber'
  | 'shared-db';

/** 프로젝트 그룹 */
export interface ProjectGroup {
  /** 그룹 이름 */
  name: string;
  /** 포함된 프로젝트 ID 목록 */
  projects: string[];
}

// ============================================================
// 크로스 프로젝트 영향도 타입
// ============================================================

/** 크로스 프로젝트 영향도 분석 결과 */
export interface CrossProjectImpact {
  /** 영향을 받는 프로젝트 목록 */
  affectedProjects: AffectedProject[];
  /** API 계약 변경 사항 */
  apiContractChanges: ApiContractChange[];
}

/** 영향을 받는 프로젝트 */
export interface AffectedProject {
  /** 프로젝트 ID */
  projectId: string;
  /** 프로젝트 이름 */
  projectName: string;
  /** 영향 수준 */
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 영향을 받는 API 목록 */
  affectedApis: string[];
  /** 영향을 받는 컴포넌트 수 */
  affectedComponents: number;
  /** 영향 요약 */
  summary: string;
}

/** API 계약 변경 */
export interface ApiContractChange {
  /** API 경로 */
  apiPath: string;
  /** 변경 유형 */
  changeType: 'add' | 'modify' | 'remove';
  /** 소비자 프로젝트 ID 목록 */
  consumers: string[];
  /** 심각도 */
  severity: 'info' | 'warning' | 'critical';
}
