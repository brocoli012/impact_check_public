"use strict";
/**
 * @module utils/index-summarizer
 * @description CodeIndex 요약 유틸리티 - 인덱스를 사람이 읽기 쉬운 요약 형태로 변환
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeIndex = summarizeIndex;
/**
 * CodeIndex를 요약 형태로 변환
 * @param index - 전체 코드 인덱스
 * @returns 인덱스 요약
 */
function summarizeIndex(index) {
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
function summarizeScreens(screens) {
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
function summarizeComponents(components) {
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
function summarizeApis(apis) {
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
function summarizePolicies(policies) {
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
function summarizeDependencies(index) {
    const { nodes, edges } = index.dependencies.graph;
    // 노드 유형별 카운트
    const nodesByType = {};
    for (const node of nodes) {
        nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }
    // 엣지 유형별 카운트
    const edgesByType = {};
    for (const edge of edges) {
        edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }
    // 노드별 연결 간선 수 계산 (from + to 모두 카운트)
    const edgeCounts = new Map();
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
//# sourceMappingURL=index-summarizer.js.map