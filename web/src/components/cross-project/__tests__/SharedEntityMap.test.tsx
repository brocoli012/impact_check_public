/**
 * @module web/components/cross-project/__tests__/SharedEntityMap.test
 * @description SharedEntityMap 컴포넌트 단위 테스트 (Phase D: TASK-109)
 * TASK-220: Interaction 테스트 추가 (REQ-018 TICKET-B)
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SharedEntityMap from '../SharedEntityMap';

/**
 * ReactFlow mock: 실제 ReactFlow 대신 핸들러를 캡처하여 테스트에서 직접 호출 가능
 */
let capturedProps: Record<string, any> = {};

vi.mock('@xyflow/react', () => {
  return {
    ReactFlow: (props: any) => {
      capturedProps = props;
      return (
        <div data-testid="mock-reactflow">
          {props.nodes?.map((node: any) => (
            <div
              key={node.id}
              data-testid={`node-${node.id}`}
              data-style={JSON.stringify(node.style)}
              onClick={(e) => props.onNodeClick?.(e, node)}
            >
              {node.data?.label}
            </div>
          ))}
          {props.edges?.map((edge: any) => (
            <div
              key={edge.id}
              data-testid={`edge-${edge.id}`}
              data-style={JSON.stringify(edge.style)}
            />
          ))}
          <div
            data-testid="mock-pane"
            onClick={() => props.onPaneClick?.()}
          />
        </div>
      );
    },
  };
});

vi.mock('@xyflow/react/dist/style.css', () => ({}));

/** 테스트 데이터 */
const mockTables = [
  { name: 'orders', projects: ['proj-a', 'proj-b'], referenceCount: 5 },
  { name: 'users', projects: ['proj-a', 'proj-c'], referenceCount: 3 },
];

const mockEvents = [
  { name: 'order-created', publishers: ['proj-a'], subscribers: ['proj-b'], referenceCount: 2 },
];

beforeEach(() => {
  capturedProps = {};
});

describe('SharedEntityMap', () => {
  it('should show empty message when no data', () => {
    render(<SharedEntityMap tables={[]} events={[]} />);
    expect(screen.getByTestId('shared-entity-map-empty')).toBeInTheDocument();
  });

  it('should render map container with tables data', () => {
    const tables = [
      { name: 'orders', projects: ['proj-a', 'proj-b'], referenceCount: 2 },
    ];
    render(<SharedEntityMap tables={tables} events={[]} />);
    expect(screen.getByTestId('shared-entity-map')).toBeInTheDocument();
  });

  it('should render map container with events data', () => {
    const events = [
      { name: 'order-created', publishers: ['proj-a'], subscribers: ['proj-b'], referenceCount: 2 },
    ];
    render(<SharedEntityMap tables={[]} events={events} />);
    expect(screen.getByTestId('shared-entity-map')).toBeInTheDocument();
  });

  it('should render map with both tables and events', () => {
    const tables = [
      { name: 'users', projects: ['proj-a', 'proj-b'], referenceCount: 2 },
    ];
    const events = [
      { name: 'user-registered', publishers: ['proj-a'], subscribers: ['proj-b'], referenceCount: 2 },
    ];
    render(<SharedEntityMap tables={tables} events={events} />);
    expect(screen.getByTestId('shared-entity-map')).toBeInTheDocument();
  });
});

describe('SharedEntityMap - Node Selection (TASK-216~220)', () => {
  it('should not show selection-info-bar initially', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);
    expect(screen.queryByTestId('selection-info-bar')).not.toBeInTheDocument();
  });

  // --- Table node selection ---
  it('should select a table node on click and show selection-info-bar with table info', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    const tableNode = screen.getByTestId('node-table-orders');
    act(() => {
      tableNode.click();
    });

    const infoBar = screen.getByTestId('selection-info-bar');
    expect(infoBar).toBeInTheDocument();
    expect(infoBar.textContent).toContain('테이블: orders');
    expect(infoBar.textContent).toContain('proj-a');
    expect(infoBar.textContent).toContain('proj-b');
    expect(infoBar.textContent).toContain('참조 횟수: 5');
  });

  it('should unselect table node when clicked again (toggle)', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    const tableNode = screen.getByTestId('node-table-orders');

    // Select
    act(() => {
      tableNode.click();
    });
    expect(screen.getByTestId('selection-info-bar')).toBeInTheDocument();

    // Unselect (same node)
    act(() => {
      tableNode.click();
    });
    expect(screen.queryByTestId('selection-info-bar')).not.toBeInTheDocument();
  });

  it('should dim unconnected nodes when table node is selected', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select 'orders' table -> connected to proj-a, proj-b
    act(() => {
      screen.getByTestId('node-table-orders').click();
    });

    // Connected nodes: proj-a, proj-b should have opacity 1
    const projA = screen.getByTestId('node-proj-proj-a');
    const projAStyle = JSON.parse(projA.getAttribute('data-style') || '{}');
    expect(projAStyle.opacity).toBe(1);

    const projB = screen.getByTestId('node-proj-proj-b');
    const projBStyle = JSON.parse(projB.getAttribute('data-style') || '{}');
    expect(projBStyle.opacity).toBe(1);

    // Unconnected node: proj-c should be dimmed
    const projC = screen.getByTestId('node-proj-proj-c');
    const projCStyle = JSON.parse(projC.getAttribute('data-style') || '{}');
    expect(projCStyle.opacity).toBe(0.2);

    // Unconnected table: users should be dimmed
    const usersNode = screen.getByTestId('node-table-users');
    const usersStyle = JSON.parse(usersNode.getAttribute('data-style') || '{}');
    expect(usersStyle.opacity).toBe(0.2);
  });

  it('should apply selected style to selected table node', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    act(() => {
      screen.getByTestId('node-table-orders').click();
    });

    const nodeEl = screen.getByTestId('node-table-orders');
    const style = JSON.parse(nodeEl.getAttribute('data-style') || '{}');
    expect(style.background).toBe('#DBEAFE');
    expect(style.border).toBe('2px solid #3B82F6');
    expect(style.opacity).toBe(1);
  });

  // --- Event node selection ---
  it('should select an event node and show publisher/subscriber info', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    act(() => {
      screen.getByTestId('node-event-order-created').click();
    });

    const infoBar = screen.getByTestId('selection-info-bar');
    expect(infoBar).toBeInTheDocument();
    expect(infoBar.textContent).toContain('이벤트: order-created');
    expect(infoBar.textContent).toContain('Publisher: proj-a');
    expect(infoBar.textContent).toContain('Subscriber: proj-b');
  });

  it('should dim unconnected nodes when event node is selected', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select 'order-created' event -> connected to proj-a (pub), proj-b (sub)
    act(() => {
      screen.getByTestId('node-event-order-created').click();
    });

    // Connected: proj-a, proj-b
    const projAStyle = JSON.parse(
      screen.getByTestId('node-proj-proj-a').getAttribute('data-style') || '{}',
    );
    expect(projAStyle.opacity).toBe(1);

    const projBStyle = JSON.parse(
      screen.getByTestId('node-proj-proj-b').getAttribute('data-style') || '{}',
    );
    expect(projBStyle.opacity).toBe(1);

    // Unconnected: proj-c
    const projCStyle = JSON.parse(
      screen.getByTestId('node-proj-proj-c').getAttribute('data-style') || '{}',
    );
    expect(projCStyle.opacity).toBe(0.2);
  });

  it('should toggle event node selection', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    const eventNode = screen.getByTestId('node-event-order-created');

    // Select
    act(() => {
      eventNode.click();
    });
    expect(screen.getByTestId('selection-info-bar')).toBeInTheDocument();

    // Unselect
    act(() => {
      eventNode.click();
    });
    expect(screen.queryByTestId('selection-info-bar')).not.toBeInTheDocument();
  });

  // --- Project node selection ---
  it('should select a project node and show related tables/events', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    act(() => {
      screen.getByTestId('node-proj-proj-a').click();
    });

    const infoBar = screen.getByTestId('selection-info-bar');
    expect(infoBar).toBeInTheDocument();
    expect(infoBar.textContent).toContain('프로젝트: proj-a');
    expect(infoBar.textContent).toContain('테이블: orders, users');
    expect(infoBar.textContent).toContain('이벤트: order-created');
  });

  it('should dim unconnected nodes when project node is selected', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select proj-b -> connected to orders table, order-created event (subscriber)
    act(() => {
      screen.getByTestId('node-proj-proj-b').click();
    });

    // Connected: table-orders, event-order-created
    const ordersStyle = JSON.parse(
      screen.getByTestId('node-table-orders').getAttribute('data-style') || '{}',
    );
    expect(ordersStyle.opacity).toBe(1);

    const eventStyle = JSON.parse(
      screen.getByTestId('node-event-order-created').getAttribute('data-style') || '{}',
    );
    expect(eventStyle.opacity).toBe(1);

    // Unconnected: users table, proj-c
    const usersStyle = JSON.parse(
      screen.getByTestId('node-table-users').getAttribute('data-style') || '{}',
    );
    expect(usersStyle.opacity).toBe(0.2);

    const projCStyle = JSON.parse(
      screen.getByTestId('node-proj-proj-c').getAttribute('data-style') || '{}',
    );
    expect(projCStyle.opacity).toBe(0.2);
  });

  it('should toggle project node selection', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    const projNode = screen.getByTestId('node-proj-proj-a');

    // Select
    act(() => {
      projNode.click();
    });
    expect(screen.getByTestId('selection-info-bar')).toBeInTheDocument();

    // Unselect
    act(() => {
      projNode.click();
    });
    expect(screen.queryByTestId('selection-info-bar')).not.toBeInTheDocument();
  });

  // --- Pane click ---
  it('should clear selection on pane click', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select a node first
    act(() => {
      screen.getByTestId('node-table-orders').click();
    });
    expect(screen.getByTestId('selection-info-bar')).toBeInTheDocument();

    // Click pane to clear
    act(() => {
      screen.getByTestId('mock-pane').click();
    });
    expect(screen.queryByTestId('selection-info-bar')).not.toBeInTheDocument();
  });

  it('should restore all nodes to full opacity after pane click', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select to dim some nodes
    act(() => {
      screen.getByTestId('node-table-orders').click();
    });

    // Verify dim
    const projCStyleBefore = JSON.parse(
      screen.getByTestId('node-proj-proj-c').getAttribute('data-style') || '{}',
    );
    expect(projCStyleBefore.opacity).toBe(0.2);

    // Pane click to clear
    act(() => {
      screen.getByTestId('mock-pane').click();
    });

    // All nodes should have opacity 1 (no connectedIds = everything visible)
    const projCStyleAfter = JSON.parse(
      screen.getByTestId('node-proj-proj-c').getAttribute('data-style') || '{}',
    );
    expect(projCStyleAfter.opacity).toBe(1);
  });

  // --- Edge dim ---
  it('should dim unconnected edges when a node is selected', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select orders table -> connected edges: edge-proj-proj-a-table-orders, edge-proj-proj-b-table-orders
    act(() => {
      screen.getByTestId('node-table-orders').click();
    });

    // Connected edge should have opacity 1
    const connectedEdge = screen.getByTestId('edge-edge-proj-proj-a-table-orders');
    const connectedEdgeStyle = JSON.parse(connectedEdge.getAttribute('data-style') || '{}');
    expect(connectedEdgeStyle.opacity).toBe(1);

    // Unconnected edge (users table edge) should be dimmed
    const unconnectedEdge = screen.getByTestId('edge-edge-proj-proj-a-table-users');
    const unconnectedEdgeStyle = JSON.parse(unconnectedEdge.getAttribute('data-style') || '{}');
    expect(unconnectedEdgeStyle.opacity).toBe(0.2);
  });

  // --- ReactFlow props ---
  it('should pass elementsSelectable=true to ReactFlow', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);
    expect(capturedProps.elementsSelectable).toBe(true);
  });

  it('should pass onNodeClick and onPaneClick handlers to ReactFlow', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);
    expect(typeof capturedProps.onNodeClick).toBe('function');
    expect(typeof capturedProps.onPaneClick).toBe('function');
  });

  // --- Transition styles ---
  it('should include transition style on nodes', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    const nodeEl = screen.getByTestId('node-proj-proj-a');
    const style = JSON.parse(nodeEl.getAttribute('data-style') || '{}');
    expect(style.transition).toBe('opacity 0.2s ease');
  });

  // --- Selection change ---
  it('should switch selection when clicking a different node', () => {
    render(<SharedEntityMap tables={mockTables} events={mockEvents} />);

    // Select table
    act(() => {
      screen.getByTestId('node-table-orders').click();
    });
    expect(screen.getByTestId('selection-info-bar').textContent).toContain('테이블: orders');

    // Switch to event
    act(() => {
      screen.getByTestId('node-event-order-created').click();
    });
    expect(screen.getByTestId('selection-info-bar').textContent).toContain('이벤트: order-created');

    // Switch to project
    act(() => {
      screen.getByTestId('node-proj-proj-a').click();
    });
    expect(screen.getByTestId('selection-info-bar').textContent).toContain('프로젝트: proj-a');
  });
});
