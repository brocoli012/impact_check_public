/**
 * @module web/components/cross-project/SharedEntityMap
 * @description 공유 엔티티 맵 - 3-layer 시각화 (프로젝트 / 엔티티&이벤트 / 연결)
 * Phase D: TASK-109
 * TASK-216~220: SharedEntityMap Interaction (REQ-018 TICKET-B)
 *
 * Layer 1 (Top): Projects
 * Layer 2 (Middle): Shared Tables + Events
 * Layer 3 (Bottom): Connection details (edges)
 */

import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from '../flowchart/EntityNode';
import EventNode from '../flowchart/EventNode';
import type { SharedTableSummary, SharedEventSummary } from '../../stores/sharedEntityStore';

interface SharedEntityMapProps {
  tables: SharedTableSummary[];
  events: SharedEventSummary[];
}

/** React Flow nodeTypes */
const nodeTypes = {
  entityNode: EntityNode,
  eventNode: EventNode,
};

/** connectedIds 계산 결과 */
interface ConnectedIds {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

function SharedEntityMap({ tables, events }: SharedEntityMapProps) {
  // State must be before early return (React hooks rule)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (tables.length === 0 && events.length === 0) {
    return (
      <div data-testid="shared-entity-map-empty" className="text-sm text-gray-400 py-8 text-center">
        공유 엔티티/이벤트가 없습니다
      </div>
    );
  }

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    // Collect all unique projects
    const projectSet = new Set<string>();
    for (const t of tables) {
      for (const p of t.projects) projectSet.add(p);
    }
    for (const e of events) {
      for (const p of e.publishers) projectSet.add(p);
      for (const s of e.subscribers) projectSet.add(s);
    }
    const projectArray = Array.from(projectSet);

    // Layer 1: Projects (top row)
    const projectSpacing = 200;
    const projectStartX = Math.max(0, (Math.max(tables.length, events.length) * 200 - projectArray.length * projectSpacing) / 2);

    projectArray.forEach((projectId, idx) => {
      allNodes.push({
        id: `proj-${projectId}`,
        type: 'default',
        position: { x: projectStartX + idx * projectSpacing, y: 0 },
        data: { label: projectId },
        style: {
          background: '#F3F4F6',
          border: '2px solid #6B7280',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          padding: '8px 12px',
          width: 160,
          textAlign: 'center' as const,
        },
      });
    });

    // Layer 2: Shared Tables (middle-left)
    const entityY = 150;
    tables.forEach((table, idx) => {
      const nodeId = `table-${table.name}`;
      allNodes.push({
        id: nodeId,
        type: 'entityNode',
        position: { x: idx * 200, y: entityY },
        data: {
          label: table.name,
          projects: table.projects,
          fieldCount: undefined,
          isShared: table.projects.length >= 2,
        },
      });

      // Edges from projects to table
      for (const pid of table.projects) {
        allEdges.push({
          id: `edge-proj-${pid}-table-${table.name}`,
          source: `proj-${pid}`,
          target: nodeId,
          style: { stroke: '#3B82F6', strokeWidth: 1.5 },
          animated: true,
        });
      }
    });

    // Layer 2: Shared Events (middle-right, offset)
    const eventStartX = tables.length * 200;
    events.forEach((event, idx) => {
      const nodeId = `event-${event.name}`;
      allNodes.push({
        id: nodeId,
        type: 'eventNode',
        position: { x: eventStartX + idx * 200, y: entityY },
        data: {
          label: event.name,
          publishers: event.publishers,
          subscribers: event.subscribers,
        },
      });

      // Edges from publisher projects to event
      for (const pid of event.publishers) {
        allEdges.push({
          id: `edge-pub-${pid}-event-${event.name}`,
          source: `proj-${pid}`,
          target: nodeId,
          label: 'pub',
          labelStyle: { fontSize: 8, fill: '#EF4444' },
          style: { stroke: '#EF4444', strokeWidth: 1.5 },
        });
      }

      // Edges from event to subscriber projects
      for (const sid of event.subscribers) {
        allEdges.push({
          id: `edge-sub-${sid}-event-${event.name}`,
          source: nodeId,
          target: `proj-${sid}`,
          label: 'sub',
          labelStyle: { fontSize: 8, fill: '#EC4899' },
          style: { stroke: '#EC4899', strokeWidth: 1.5, strokeDasharray: '5,5' },
        });
      }
    });

    return { nodes: allNodes, edges: allEdges };
  }, [tables, events]);

  /** connectedIds: selectedNodeId 기반으로 연결된 노드/엣지 ID 계산 */
  const connectedIds = useMemo<ConnectedIds | null>(() => {
    if (!selectedNodeId) return null;

    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    // Always include the selected node itself
    nodeIds.add(selectedNodeId);

    if (selectedNodeId.startsWith('table-')) {
      // Table node selected -> find connected project nodes + edges
      const tableName = selectedNodeId.replace('table-', '');
      const table = tables.find(t => t.name === tableName);
      if (table) {
        for (const pid of table.projects) {
          nodeIds.add(`proj-${pid}`);
          edgeIds.add(`edge-proj-${pid}-table-${tableName}`);
        }
      }
    } else if (selectedNodeId.startsWith('event-')) {
      // Event node selected -> find pub/sub project nodes + edges
      const eventName = selectedNodeId.replace('event-', '');
      const event = events.find(e => e.name === eventName);
      if (event) {
        for (const pid of event.publishers) {
          nodeIds.add(`proj-${pid}`);
          edgeIds.add(`edge-pub-${pid}-event-${eventName}`);
        }
        for (const sid of event.subscribers) {
          nodeIds.add(`proj-${sid}`);
          edgeIds.add(`edge-sub-${sid}-event-${eventName}`);
        }
      }
    } else if (selectedNodeId.startsWith('proj-')) {
      // Project node selected -> find referenced tables/events + edges
      const projectId = selectedNodeId.replace('proj-', '');
      for (const table of tables) {
        if (table.projects.includes(projectId)) {
          nodeIds.add(`table-${table.name}`);
          edgeIds.add(`edge-proj-${projectId}-table-${table.name}`);
        }
      }
      for (const event of events) {
        if (event.publishers.includes(projectId)) {
          nodeIds.add(`event-${event.name}`);
          edgeIds.add(`edge-pub-${projectId}-event-${event.name}`);
        }
        if (event.subscribers.includes(projectId)) {
          nodeIds.add(`event-${event.name}`);
          edgeIds.add(`edge-sub-${projectId}-event-${event.name}`);
        }
      }
    }

    return { nodeIds, edgeIds };
  }, [selectedNodeId, tables, events]);

  /** Apply dim / highlight styles to nodes */
  const nodes: Node[] = useMemo(() => {
    return rawNodes.map(node => {
      const isConnected = !connectedIds || connectedIds.nodeIds.has(node.id);
      const isSelected = node.id === selectedNodeId;

      const baseStyle = node.style || {};
      const opacity = isConnected ? 1 : 0.2;
      const transition = 'opacity 0.2s ease';

      if (isSelected) {
        return {
          ...node,
          style: {
            ...baseStyle,
            opacity: 1,
            transition,
            background: '#DBEAFE',
            border: '2px solid #3B82F6',
          },
        };
      }

      return {
        ...node,
        style: {
          ...baseStyle,
          opacity,
          transition,
        },
      };
    });
  }, [rawNodes, connectedIds, selectedNodeId]);

  /** Apply dim / highlight styles to edges */
  const edges: Edge[] = useMemo(() => {
    return rawEdges.map(edge => {
      const isConnected = !connectedIds || connectedIds.edgeIds.has(edge.id);
      const opacity = isConnected ? 1 : 0.2;

      return {
        ...edge,
        style: {
          ...edge.style,
          opacity,
          transition: 'opacity 0.2s ease',
        },
      };
    });
  }, [rawEdges, connectedIds]);

  /** Toggle node selection on click */
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
  }, []);

  /** Clear selection on pane click */
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  /** Build selection info bar content */
  const selectionInfo = useMemo(() => {
    if (!selectedNodeId) return null;

    if (selectedNodeId.startsWith('table-')) {
      const tableName = selectedNodeId.replace('table-', '');
      const table = tables.find(t => t.name === tableName);
      if (!table) return null;
      return {
        type: 'table' as const,
        name: tableName,
        projects: table.projects,
        referenceCount: table.referenceCount,
      };
    }

    if (selectedNodeId.startsWith('event-')) {
      const eventName = selectedNodeId.replace('event-', '');
      const event = events.find(e => e.name === eventName);
      if (!event) return null;
      return {
        type: 'event' as const,
        name: eventName,
        publishers: event.publishers,
        subscribers: event.subscribers,
      };
    }

    if (selectedNodeId.startsWith('proj-')) {
      const projectId = selectedNodeId.replace('proj-', '');
      const relatedTables = tables.filter(t => t.projects.includes(projectId)).map(t => t.name);
      const relatedEvents = events.filter(
        e => e.publishers.includes(projectId) || e.subscribers.includes(projectId),
      ).map(e => e.name);
      return {
        type: 'project' as const,
        name: projectId,
        tables: relatedTables,
        events: relatedEvents,
      };
    }

    return null;
  }, [selectedNodeId, tables, events]);

  return (
    <div data-testid="shared-entity-map">
      <div style={{ height: 350, width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnDrag={true}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
        />
      </div>
      {selectionInfo && (
        <div
          data-testid="selection-info-bar"
          className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm"
        >
          {selectionInfo.type === 'table' && (
            <div>
              <span className="font-semibold text-blue-700">테이블: {selectionInfo.name}</span>
              <span className="ml-3 text-gray-600">
                프로젝트: {selectionInfo.projects.join(', ')}
              </span>
              <span className="ml-3 text-gray-500">
                참조 횟수: {selectionInfo.referenceCount}
              </span>
            </div>
          )}
          {selectionInfo.type === 'event' && (
            <div>
              <span className="font-semibold text-red-600">이벤트: {selectionInfo.name}</span>
              <span className="ml-3 text-gray-600">
                Publisher: {selectionInfo.publishers.join(', ')}
              </span>
              <span className="ml-3 text-gray-600">
                Subscriber: {selectionInfo.subscribers.join(', ')}
              </span>
            </div>
          )}
          {selectionInfo.type === 'project' && (
            <div>
              <span className="font-semibold text-gray-700">프로젝트: {selectionInfo.name}</span>
              {selectionInfo.tables.length > 0 && (
                <span className="ml-3 text-gray-600">
                  테이블: {selectionInfo.tables.join(', ')}
                </span>
              )}
              {selectionInfo.events.length > 0 && (
                <span className="ml-3 text-gray-600">
                  이벤트: {selectionInfo.events.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SharedEntityMap;
