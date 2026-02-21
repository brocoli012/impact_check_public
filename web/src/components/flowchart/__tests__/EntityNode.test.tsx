/**
 * @module web/components/flowchart/__tests__/EntityNode.test
 * @description EntityNode 커스텀 노드 단위 테스트 (Phase D: TASK-108)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import EntityNode from '../EntityNode';

function renderEntityNode(data: Record<string, unknown>) {
  const props = {
    id: 'test-entity',
    data,
    type: 'entityNode',
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
      <EntityNode {...(props as any)} />
    </ReactFlowProvider>
  );
}

describe('EntityNode', () => {
  it('should render table name', () => {
    renderEntityNode({
      label: 'orders',
      projects: ['proj-a', 'proj-b'],
      isShared: true,
    });

    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('should show project count', () => {
    renderEntityNode({
      label: 'users',
      projects: ['proj-a', 'proj-b', 'proj-c'],
      isShared: true,
    });

    expect(screen.getByText('3개 프로젝트')).toBeInTheDocument();
  });

  it('should show TABLE badge', () => {
    renderEntityNode({
      label: 'payments',
      projects: ['proj-a'],
      isShared: false,
    });

    expect(screen.getByText('TABLE')).toBeInTheDocument();
  });

  it('should show field count when provided', () => {
    renderEntityNode({
      label: 'orders',
      projects: ['proj-a'],
      fieldCount: 5,
      isShared: false,
    });

    expect(screen.getByText('5개 필드')).toBeInTheDocument();
  });

  it('should have entity-node test id', () => {
    renderEntityNode({
      label: 'test',
      projects: [],
      isShared: false,
    });

    expect(screen.getByTestId('entity-node')).toBeInTheDocument();
  });
});
