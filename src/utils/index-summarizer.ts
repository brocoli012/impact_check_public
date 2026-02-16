/**
 * @module utils/index-summarizer
 * @description CodeIndex 요약 유틸리티 - 인덱스를 사람이 읽기 쉬운 요약 형태로 변환
 */

import { CodeIndex, IndexMeta, ScreenInfo, ComponentInfo, ApiEndpoint, PolicyInfo } from '../types/index';

/** 화면 요약 정보 */
export interface ScreenSummary {
  /** 화면 ID */
  id: string;
  /** 화면 이름 */
  name: string;
  /** 라우트 경로 */
  route: string;
  /** 포함 컴포넌트 수 */
  componentCount: number;
  /** 호출 API 수 */
  apiCallCount: number;
  /** 복잡도 */
  complexity: string;
}

/** 컴포넌트 요약 정보 */
export interface ComponentSummary {
  /** 컴포넌트 ID */
  id: string;
  /** 컴포넌트 이름 */
  name: string;
  /** 컴포넌트 유형 */
  type: string;
  /** import 수 */
  importCount: number;
  /** importedBy 수 */
  importedByCount: number;
}

/** API 요약 정보 */
export interface ApiSummary {
  /** API ID */
  id: string;
  /** HTTP 메서드 */
  method: string;
  /** API 경로 */
  path: string;
  /** 호출자 수 */
  calledByCount: number;
}

/** 정책 요약 정보 */
export interface PolicySummaryItem {
  /** 정책 ID */
  id: string;
  /** 정책명 */
  name: string;
  /** 카테고리 */
  category: string;
  /** 출처 */
  source: string;
}

/** 의존성 그래프 요약 */
export interface DependencyOverview {
  /** 총 노드 수 */
  totalNodes: number;
  /** 총 엣지 수 */
  totalEdges: number;
  /** 노드 유형별 수 */
  nodesByType: Record<string, number>;
  /** 엣지 유형별 수 */
  edgesByType: Record<string, number>;
  /** 의존성 간선이 가장 많은 상위 10개 노드 */
  topConnected: Array<{ id: string; name: string; type: string; edgeCount: number }>;
}

/** 인덱스 전체 요약 */
export interface IndexSummary {
  /** 메타 정보 */
  meta: IndexMeta;
  /** 화면 요약 목록 */
  screens: ScreenSummary[];
  /** 컴포넌트 요약 목록 */
  components: ComponentSummary[];
  /** API 요약 목록 */
  apis: ApiSummary[];
  /** 정책 요약 목록 */
  policies: PolicySummaryItem[];
  /** 의존성 그래프 요약 */
  dependencyOverview: DependencyOverview;
}

/**
 * CodeIndex를 요약 형태로 변환
 * @param index - 전체 코드 인덱스
 * @returns 인덱스 요약
 */
export function summarizeIndex(index: CodeIndex): IndexSummary {
  return {
    meta: index.meta,
    screens: summarizeScreens(index.screens),
    components: summarizeComponents(index.components),
    apis: summarizeApis(index.apis),
    policies: summarizePolicies(index.policies),
    dependencyOverview: summarizeDependencies(index),
  };
}

/**
 * 화면 목록 요약
 */
function summarizeScreens(screens: ScreenInfo[]): ScreenSummary[] {
  return screens.map(s => ({
    id: s.id,
    name: s.name,
    route: s.route,
    componentCount: s.components.length,
    apiCallCount: s.apiCalls.length,
    complexity: s.metadata.complexity,
  }));
}

/**
 * 컴포넌트 목록 요약
 */
function summarizeComponents(components: ComponentInfo[]): ComponentSummary[] {
  return components.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    importCount: c.imports.length,
    importedByCount: c.importedBy.length,
  }));
}

/**
 * API 목록 요약
 */
function summarizeApis(apis: ApiEndpoint[]): ApiSummary[] {
  return apis.map(a => ({
    id: a.id,
    method: a.method,
    path: a.path,
    calledByCount: a.calledBy.length,
  }));
}

/**
 * 정책 목록 요약
 */
function summarizePolicies(policies: PolicyInfo[]): PolicySummaryItem[] {
  return policies.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    source: p.source,
  }));
}

/**
 * 의존성 그래프 요약 (topConnected 포함)
 */
function summarizeDependencies(index: CodeIndex): DependencyOverview {
  const { nodes, edges } = index.dependencies.graph;

  // 노드 유형별 카운트
  const nodesByType: Record<string, number> = {};
  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  // 엣지 유형별 카운트
  const edgesByType: Record<string, number> = {};
  for (const edge of edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }

  // 노드별 연결 간선 수 계산 (from + to 모두 카운트)
  const edgeCounts = new Map<string, number>();
  for (const edge of edges) {
    edgeCounts.set(edge.from, (edgeCounts.get(edge.from) || 0) + 1);
    edgeCounts.set(edge.to, (edgeCounts.get(edge.to) || 0) + 1);
  }

  // 상위 10개 노드 추출
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const topConnected = Array.from(edgeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, edgeCount]) => {
      const node = nodeMap.get(id);
      return {
        id,
        name: node?.name || id,
        type: node?.type || 'unknown',
        edgeCount,
      };
    });

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    edgesByType,
    topConnected,
  };
}
