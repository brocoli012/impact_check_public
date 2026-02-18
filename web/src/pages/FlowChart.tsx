/**
 * @module web/pages/FlowChart
 * @description 플로우차트 페이지 - React Flow 캔버스, 필터 바, 미니맵, 줌 컨트롤
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes, edgeTypes, FilterBar } from '../components/flowchart';
import SvgDefs from '../components/flowchart/SvgDefs';
import { useFlowLayout } from '../hooks/useFlowLayout';
import { transformToFlow } from '../utils/flowTransformer';
import { useFlowStore } from '../stores/flowStore';
import { useResultStore } from '../stores/resultStore';
import { useEnsureResult } from '../hooks/useEnsureResult';
import DetailPanel from '../components/layout/DetailPanel';
import type { Task } from '../types';

/**
 * 요구사항 필터에 해당하는 태스크 ID와 화면 ID를 계산
 */
function getRelatedIdsForRequirement(
  requirementFilter: string,
  allTasks: Task[],
  affectedScreens: { screenId: string; tasks: Task[] }[],
): { relatedTaskIds: Set<string>; relatedScreenIds: Set<string> } {
  const relatedTaskIds = new Set<string>();
  const relatedScreenIds = new Set<string>();

  // sourceRequirementIds에 해당 요구사항 ID가 포함된 태스크 찾기
  for (const task of allTasks) {
    if (task.sourceRequirementIds?.includes(requirementFilter)) {
      relatedTaskIds.add(task.id);
    }
  }

  // 관련 태스크가 속한 화면 찾기
  for (const screen of affectedScreens) {
    for (const task of screen.tasks) {
      if (relatedTaskIds.has(task.id)) {
        relatedScreenIds.add(screen.screenId);
        break;
      }
    }
  }

  return { relatedTaskIds, relatedScreenIds };
}

/**
 * 요구사항 필터에 따라 노드에 opacity 스타일을 적용
 */
function applyRequirementHighlight(
  nodesArr: Node[],
  relatedTaskIds: Set<string>,
  relatedScreenIds: Set<string>,
): Node[] {
  return nodesArr.map((node) => {
    let isRelated = false;

    if (node.type === 'requirement') {
      // 최상위 Requirement 노드는 항상 표시
      isRelated = true;
    } else if (node.type === 'system') {
      // 시스템 노드는 항상 표시 (하위에 관련 화면이 있을 수 있음)
      isRelated = true;
    } else if (node.type === 'screen') {
      // 화면 노드: 관련 태스크가 속한 화면인지 확인
      const screenId = node.id.replace('screen-', '');
      isRelated = relatedScreenIds.has(screenId);
    } else if (node.type === 'feature') {
      // Feature 노드: 태스크 ID로 매칭
      const taskId = node.id.replace('feature-', '');
      isRelated = relatedTaskIds.has(taskId);
    } else if (node.type === 'module') {
      // Module 노드: 부모 태스크 ID 추출 (module-{taskId}-{index})
      const parts = node.id.replace('module-', '').split('-');
      // taskId는 마지막 숫자(index)를 제외한 부분
      parts.pop(); // index 제거
      const taskId = parts.join('-');
      isRelated = relatedTaskIds.has(taskId);
    } else if (node.type === 'check') {
      // Check 노드: 부모 태스크 ID 추출 (check-{taskId}-{index})
      const parts = node.id.replace('check-', '').split('-');
      parts.pop(); // index 제거
      const taskId = parts.join('-');
      isRelated = relatedTaskIds.has(taskId);
    } else if (node.type === 'policy' || node.type === 'policyWarning') {
      // Policy/PolicyWarning 노드는 dim 처리
      isRelated = false;
    }

    if (isRelated) {
      return {
        ...node,
        style: {
          ...node.style,
          opacity: 1,
          transition: 'opacity 0.3s ease',
        },
      };
    } else {
      return {
        ...node,
        style: {
          ...node.style,
          opacity: 0.3,
          transition: 'opacity 0.3s ease',
        },
      };
    }
  });
}

function FlowChart() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const filter = useFlowStore((s) => s.filter);
  const expandedNodeIds = useFlowStore((s) => s.expandedNodeIds);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const selectNode = useFlowStore((s) => s.selectNode);
  const toggleExpand = useFlowStore((s) => s.toggleExpand);

  // 요구사항 목록
  const requirements = currentResult?.parsedSpec?.requirements;

  // 데이터 변환
  const { nodes: rawNodes, edges: rawEdges, expandableNodeIds } = useMemo(() => {
    if (!currentResult) return { nodes: [], edges: [], expandableNodeIds: [] };
    return transformToFlow(currentResult, expandedNodeIds, filter);
  }, [currentResult, expandedNodeIds, filter]);

  // 요구사항 필터에 따른 하이라이트 적용
  const highlightedNodes = useMemo(() => {
    if (!filter.requirementFilter || !currentResult) return rawNodes;

    const { relatedTaskIds, relatedScreenIds } = getRelatedIdsForRequirement(
      filter.requirementFilter,
      currentResult.tasks,
      currentResult.affectedScreens,
    );

    // 관련 태스크가 없으면 하이라이트 미적용 (전체 표시)
    if (relatedTaskIds.size === 0) return rawNodes;

    return applyRequirementHighlight(rawNodes, relatedTaskIds, relatedScreenIds);
  }, [rawNodes, filter.requirementFilter, currentResult]);

  // 자동 레이아웃 적용
  const layoutedNodes = useFlowLayout(highlightedNodes, rawEdges);

  // React Flow 상태
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // 레이아웃 변경 시 노드/엣지 업데이트
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(rawEdges);
  }, [layoutedNodes, rawEdges, setNodes, setEdges]);

  // 노드 클릭 핸들러
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Screen 노드: 확장/축소 토글
      if (node.type === 'screen') {
        const screenId = node.id.replace('screen-', '');
        toggleExpand(screenId);
      }
      // 선택 상태 토글
      if (selectedNodeId === node.id) {
        selectNode(null);
      } else {
        selectNode(node.id);
      }
    },
    [selectedNodeId, selectNode, toggleExpand],
  );

  // 캔버스 클릭 -> 선택 해제
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // 선택된 노드 찾기
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, nodes]);

  if (!currentResult) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* 필터 바 */}
      <div style={{ marginBottom: 8 }}>
        <FilterBar expandableNodeIds={expandableNodeIds} requirements={requirements} />
      </div>

      {/* SVG marker definitions (1회만 렌더링) */}
      <SvgDefs />

      {/* React Flow 캔버스 */}
      <div
        style={{
          flex: 1,
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FAFBFC',
          overflow: 'hidden',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'custom' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
          <MiniMap
            position="bottom-right"
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
            }}
            maskColor="rgba(0,0,0,0.08)"
            nodeStrokeWidth={2}
          />
          <Controls
            position="bottom-right"
            style={{
              marginBottom: 130,
              borderRadius: 6,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          />
        </ReactFlow>
      </div>

      {/* 선택된 노드 상세 패널 */}
      {selectedNode && (
        <DetailPanel node={selectedNode} onClose={() => selectNode(null)} />
      )}
    </div>
  );
}

export default FlowChart;
