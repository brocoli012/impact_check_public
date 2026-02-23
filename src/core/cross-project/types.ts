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

/** detectAndSave() 결과 */
export interface DetectResult {
  /** 새로 감지된 링크 수 */
  detected: number;
  /** 신규 저장된 링크 수 */
  saved: number;
  /** 전체 링크 수 (수동 + 자동) */
  total: number;
  /** 타입별 통계 */
  byType: Record<string, number>;
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

// ============================================================
// Gap Detection 타입 (Phase 3)
// ============================================================

/** 갭 심각도 */
export type GapSeverity = 'high' | 'medium' | 'low';

/** 갭 유형 */
export type GapType = 'stale-link' | 'unanalyzed-project' | 'low-confidence' | 'stale-index';

/** 갭 항목 */
export interface GapItem {
  /** 갭 유형 */
  type: GapType;
  /** 심각도 */
  severity: GapSeverity;
  /** 관련 프로젝트 ID */
  projectId: string;
  /** 갭 설명 */
  description: string;
  /** 상세 정보 */
  detail: GapDetail;
  /** 자동 수정 가능 여부 */
  fixable: boolean;
  /** 수정 명령어 (fixable=true 시) */
  fixCommand?: string;
}

/** 갭 상세 정보 */
export interface GapDetail {
  /** 링크 ID */
  linkId?: string;
  /** 소스 프로젝트 ID */
  sourceProject?: string;
  /** 대상 프로젝트 ID */
  targetProject?: string;
  /** 링크 확인 시각 */
  confirmedAt?: string;
  /** 인덱스 업데이트 시각 */
  indexUpdatedAt?: string;
  /** 분석 결과 ID */
  analysisId?: string;
  /** 총점 */
  totalScore?: number;
  /** 마지막 git 커밋 시각 */
  lastGitCommit?: string;
}

/** 갭 탐지 결과 */
export interface GapCheckResult {
  /** 탐지된 갭 목록 */
  gaps: GapItem[];
  /** 요약 통계 */
  summary: {
    /** 전체 갭 수 */
    total: number;
    /** high 심각도 수 */
    high: number;
    /** medium 심각도 수 */
    medium: number;
    /** low 심각도 수 */
    low: number;
    /** 자동 수정 가능 수 */
    fixable: number;
  };
  /** 상태별 제외 건수 (TASK-190 준비) */
  excludedCounts?: {
    /** completed 상태 제외 수 */
    completed: number;
    /** on-hold 상태 제외 수 */
    onHold: number;
    /** archived 상태 제외 수 */
    archived: number;
  };
  /** 탐지 시각 */
  checkedAt: string;
}

/** 갭 수정 결과 */
export interface FixResult {
  /** 수정 성공 수 */
  fixed: number;
  /** 수정 실패 수 */
  failed: number;
  /** 수정 상세 내역 */
  details: Array<{
    gap: GapItem;
    success: boolean;
    message: string;
  }>;
}
