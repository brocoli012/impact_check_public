/**
 * @module web/components/cross-project/SharedEntityMap
 * @description 공유 엔티티 맵 - 3-layer 시각화 (프로젝트 / 엔티티&이벤트 / 연결)
 * Phase D: TASK-109
 *
 * Layer 1 (Top): Projects
 * Layer 2 (Middle): Shared Tables + Events
 * Layer 3 (Bottom): Connection details (edges)
 */

import { useMemo } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
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

function SharedEntityMap({ tables, events }: SharedEntityMapProps) {
  if (tables.length === 0 && events.length === 0) {
    return (
      <div data-testid="shared-entity-map-empty" className="text-sm text-gray-400 py-8 text-center">
        공유 엔티티/이벤트가 없습니다
      </div>
    );
  }

  const { nodes, edges } = useMemo(() => {
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
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </div>
  );
}

export default SharedEntityMap;
