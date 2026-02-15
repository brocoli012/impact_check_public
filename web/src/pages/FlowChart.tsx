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

function FlowChart() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const filter = useFlowStore((s) => s.filter);
  const expandedNodeIds = useFlowStore((s) => s.expandedNodeIds);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const selectNode = useFlowStore((s) => s.selectNode);
  const toggleExpand = useFlowStore((s) => s.toggleExpand);

  // 데이터 변환
  const { nodes: rawNodes, edges: rawEdges, expandableNodeIds } = useMemo(() => {
    if (!currentResult) return { nodes: [], edges: [], expandableNodeIds: [] };
    return transformToFlow(currentResult, expandedNodeIds, filter);
  }, [currentResult, expandedNodeIds, filter]);

  // 자동 레이아웃 적용
  const layoutedNodes = useFlowLayout(rawNodes, rawEdges);

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
        <FilterBar expandableNodeIds={expandableNodeIds} />
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
