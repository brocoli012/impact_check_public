/**
 * @module web/components/flowchart/__tests__/EventNode.test
 * @description EventNode 커스텀 노드 단위 테스트 (Phase D: TASK-108)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import EventNode from '../EventNode';

function renderEventNode(data: Record<string, unknown>) {
  const props = {
    id: 'test-event',
    data,
    type: 'eventNode',
    selected: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    deletable: false,
    selectable: false,
    width: 200,
    height: 100,
  };

  return render(
    <ReactFlowProvider>
      <EventNode {...(props as any)} />
    </ReactFlowProvider>
  );
}

describe('EventNode', () => {
  it('should render event name', () => {
    renderEventNode({
      label: 'order-created',
      publishers: ['proj-a'],
      subscribers: ['proj-b'],
    });

    expect(screen.getByText('order-created')).toBeInTheDocument();
  });

  it('should show pub/sub counts', () => {
    renderEventNode({
      label: 'user-registered',
      publishers: ['proj-a', 'proj-c'],
      subscribers: ['proj-b'],
    });

    expect(screen.getByText('Pub: 2')).toBeInTheDocument();
    expect(screen.getByText('Sub: 1')).toBeInTheDocument();
  });

  it('should show EVENT badge', () => {
    renderEventNode({
      label: 'payment-completed',
      publishers: ['proj-a'],
      subscribers: [],
    });

    expect(screen.getByText('EVENT')).toBeInTheDocument();
  });

  it('should have event-node test id', () => {
    renderEventNode({
      label: 'test',
      publishers: [],
      subscribers: [],
    });

    expect(screen.getByTestId('event-node')).toBeInTheDocument();
  });
});
