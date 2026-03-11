/**
 * @module types/review
 * @description 리뷰 결과서 관련 타입 정의 (REQ-018-A1)
 */

import { ISODateString } from './common';

/** 리뷰 섹션 유형 */
export type ReviewSectionType =
  | 'overview'
  | 'impact-summary'
  | 'data-flow'
  | 'sequence-diagram'
  | 'user-process'
  | 'domain-analysis'
  | 'task-list'
  | 'planning-checks'
  | 'risks'
  | 'result-location'
  | 'policy-changes'
  | 'changelog';

/** 리뷰 결과서 생성 옵션 */
export interface ReviewGenerateOptions {
  projectId: string;
  analysisId?: string;
  outputPath?: string;
  includeSections?: ReviewSectionType[];
  skipMermaid?: boolean;
  force?: boolean;
}

/** 멀티프로젝트 리뷰 생성 옵션 (Phase B) */
export interface MultiProjectReviewOptions extends ReviewGenerateOptions {
  projectIds: string[];
  groupName?: string;
}

/** 멀티프로젝트 리뷰 입력 단위 (Phase B2) */
export interface ProjectReviewInput {
  projectId: string;
  result: import('./analysis').ConfidenceEnrichedResult;
}

/** 멀티프로젝트 리뷰 문서 메타데이터 (Phase B2) */
export interface MultiProjectReviewMetadata {
  generatedBy: string;
  generatedAt: ISODateString;
  projectIds: string[];
  specTitle: string;
  totalProjects: number;
  totalTasks: number;
  projectSummaries: {
    projectId: string;
    totalScore: number;
    grade: string;
    taskCount: number;
  }[];
  sections: ReviewSectionType[];
}

/** 멀티프로젝트 리뷰 문서 전체 구조 (Phase B2) */
export interface MultiProjectReviewDocument {
  metadata: MultiProjectReviewMetadata;
  markdown: string;
}

/** 생성된 리뷰 결과서 메타 */
export interface GeneratedReview {
  filePath: string;
  generatedAt: ISODateString;
  sourceAnalysisId: string;
  sourceProjectIds: string[];
  sections: ReviewSectionType[];
  skippedSections: { section: ReviewSectionType; reason: string }[];
  totalLines: number;
  mermaidDiagramCount?: number;
}

/** 섹션 렌더링 결과 */
export interface SectionRenderResult {
  type: ReviewSectionType;
  content: string;
  success: boolean;
  itemCount?: number;
  skipReason?: string;
}

/** 리뷰 문서 메타데이터 */
export interface ReviewMetadata {
  generatedBy: string;
  generatedAt: ISODateString;
  projectId: string;
  analysisId: string;
  specTitle: string;
  totalScore: number;
  grade: string;
  taskCount: number;
  sections: ReviewSectionType[];
}

/** 리뷰 문서 전체 구조 */
export interface ReviewDocument {
  metadata: ReviewMetadata;
  sections: SectionRenderResult[];
  markdown: string;
}

/** Phase A에서 필수로 포함되는 섹션 */
export const REQUIRED_SECTIONS: ReviewSectionType[] = [
  'overview', 'impact-summary', 'task-list', 'risks', 'result-location', 'changelog',
];

/** Phase B 전용 섹션 */
export const PHASE_B_SECTIONS: ReviewSectionType[] = [
  'data-flow', 'sequence-diagram', 'user-process',
];

/** 전체 섹션 순서 (문서 내 출력 순서) */
export const SECTION_ORDER: ReviewSectionType[] = [
  'overview', 'impact-summary', 'data-flow', 'sequence-diagram', 'user-process',
  'domain-analysis', 'task-list', 'planning-checks', 'risks', 'result-location',
  'policy-changes', 'changelog',
];

/** 섹션 한국어 이름 매핑 */
export const SECTION_NAMES: Record<ReviewSectionType, string> = {
  'overview': '기획 개요',
  'impact-summary': '영향 범위 분석 요약',
  'data-flow': '데이터 흐름도',
  'sequence-diagram': '상세 데이터 흐름',
  'user-process': '사용자 이용 프로세스',
  'domain-analysis': '도메인 특화 분석',
  'task-list': '전체 태스크 목록',
  'planning-checks': '기획 확인 필요 사항',
  'risks': '리스크 및 주의사항',
  'result-location': '분석 결과 저장 위치',
  'policy-changes': '정책 변경 사항',
  'changelog': '변경 이력',
};

/** 모든 유효한 섹션 타입 목록 */
export const ALL_SECTION_TYPES: ReviewSectionType[] = Object.keys(SECTION_NAMES) as ReviewSectionType[];

// ============================================================
// 정책 문서 관리 타입 (REQ-018-A3)
// ============================================================

/** 정책 문서 전체 내용 (저장/조회 시 사용) */
export interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  confirmedAt: string;
  project?: string;
  tags: string[];
}

/** 정책 인덱스 (index.json 스키마) */
export interface PolicyIndex {
  policies: PolicyDocumentEntry[];
  lastUpdated: string;
}

/** 정책 인덱스 엔트리 (인덱스 파일 내 각 항목) */
export interface PolicyDocumentEntry {
  id: string;
  title: string;
  category: string;
  filePath: string;
  project?: string;
  tags: string[];
  confirmedAt: string;
}
