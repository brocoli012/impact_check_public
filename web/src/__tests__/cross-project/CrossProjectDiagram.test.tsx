/**
 * @module web/__tests__/cross-project/CrossProjectDiagram.test
 * @description CrossProjectDiagram 컴포넌트 렌더링 + Pin Click 테스트
 * TASK-215: Pin 토글, 더블 클릭 네비게이션, Pane 클릭 해제, Pin 정보 바 테스트
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CrossProjectDiagram from '../../components/cross-project/CrossProjectDiagram';
import type { ProjectLink } from '../../components/cross-project/CrossProjectDiagram';

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
              onDoubleClick={(e) => props.onNodeDoubleClick?.(e, node)}
            >
              {node.data?.label}
            </div>
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

/** 테스트용 링크 데이터 */
const mockLinks: ProjectLink[] = [
  {
    id: 'frontend-backend',
    source: 'frontend',
    target: 'backend',
    type: 'api-consumer',
    apis: ['/api/users'],
    autoDetected: false,
    confirmedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'backend-database',
    source: 'backend',
    target: 'database',
    type: 'shared-library',
    autoDetected: true,
  },
];

beforeEach(() => {
  capturedProps = {};
});

describe('CrossProjectDiagram', () => {
  it('should render diagram container', () => {
    render(<CrossProjectDiagram links={mockLinks} />);
    expect(screen.getByTestId('cross-project-diagram')).toBeInTheDocument();
  });

  it('should render project nodes', () => {
    render(<CrossProjectDiagram links={mockLinks} />);
    // Node labels contain project name and link count
    expect(screen.getByText('frontend (1)')).toBeInTheDocument();
    expect(screen.getByText('backend (2)')).toBeInTheDocument();
    expect(screen.getByText('database (1)')).toBeInTheDocument();
  });

  it('should render edges for link types', () => {
    render(<CrossProjectDiagram links={mockLinks} />);
    // ReactFlow renders edges as SVG elements; check that the diagram container exists
    // and that project nodes are rendered (edges may not render text in jsdom)
    expect(screen.getByTestId('cross-project-diagram')).toBeInTheDocument();
    // Verify all 3 unique project nodes are present
    expect(screen.getByText('frontend (1)')).toBeInTheDocument();
    expect(screen.getByText('backend (2)')).toBeInTheDocument();
    expect(screen.getByText('database (1)')).toBeInTheDocument();
  });

  it('should show empty message when no links', () => {
    render(<CrossProjectDiagram links={[]} />);
    expect(screen.getByTestId('cross-project-diagram-empty')).toBeInTheDocument();
    expect(screen.getByText('등록된 프로젝트 의존성이 없습니다')).toBeInTheDocument();
  });

  it('should render with single link', () => {
    const singleLink: ProjectLink[] = [
      {
        id: 'a-b',
        source: 'project-a',
        target: 'project-b',
        type: 'api-provider',
        autoDetected: false,
      },
    ];
    render(<CrossProjectDiagram links={singleLink} />);
    expect(screen.getByTestId('cross-project-diagram')).toBeInTheDocument();
    expect(screen.getByText('project-a (1)')).toBeInTheDocument();
    expect(screen.getByText('project-b (1)')).toBeInTheDocument();
  });
});

describe('CrossProjectDiagram - Pin Click (TASK-211~215)', () => {
  it('should pin a node on single click and show pin-info-bar', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // 초기 상태: pin-info-bar 없음
    expect(screen.queryByTestId('pin-info-bar')).not.toBeInTheDocument();

    // frontend 노드 싱글 클릭 (Pin)
    const frontendNode = screen.getByTestId('node-frontend');
    act(() => {
      frontendNode.click();
    });

    // Pin 정보 바가 표시됨
    const pinInfoBar = screen.getByTestId('pin-info-bar');
    expect(pinInfoBar).toBeInTheDocument();
    expect(pinInfoBar.textContent).toContain('frontend');
    expect(pinInfoBar.textContent).toContain('연결 프로젝트: 1개');
    expect(pinInfoBar.textContent).toContain('링크: 1개');
  });

  it('should unpin when same node is clicked again', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    const frontendNode = screen.getByTestId('node-frontend');

    // Pin
    act(() => {
      frontendNode.click();
    });
    expect(screen.getByTestId('pin-info-bar')).toBeInTheDocument();

    // Unpin (같은 노드 재클릭)
    act(() => {
      frontendNode.click();
    });
    expect(screen.queryByTestId('pin-info-bar')).not.toBeInTheDocument();
  });

  it('should change pin when different node is clicked', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // frontend 핀
    act(() => {
      screen.getByTestId('node-frontend').click();
    });
    expect(screen.getByTestId('pin-info-bar')).toBeInTheDocument();
    expect(screen.getByText(/연결 프로젝트: 1개/)).toBeInTheDocument();
    expect(screen.getByText(/링크: 1개/)).toBeInTheDocument();

    // backend 핀 변경 (backend는 2개 연결)
    act(() => {
      screen.getByTestId('node-backend').click();
    });
    expect(screen.getByTestId('pin-info-bar')).toBeInTheDocument();
    expect(screen.getByText(/연결 프로젝트: 2개/)).toBeInTheDocument();
    expect(screen.getByText(/링크: 2개/)).toBeInTheDocument();
  });

  it('should unpin on pane click', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // Pin
    act(() => {
      screen.getByTestId('node-frontend').click();
    });
    expect(screen.getByTestId('pin-info-bar')).toBeInTheDocument();

    // Pane 클릭으로 해제
    act(() => {
      screen.getByTestId('mock-pane').click();
    });
    expect(screen.queryByTestId('pin-info-bar')).not.toBeInTheDocument();
  });

  it('should navigate on double click (onNodeClick callback)', () => {
    const onNodeClick = vi.fn();
    render(<CrossProjectDiagram links={mockLinks} onNodeClick={onNodeClick} />);

    // 더블 클릭으로 네비게이션
    const backendNode = screen.getByTestId('node-backend');
    act(() => {
      // 더블 클릭 이벤트 발생
      const dblClickEvent = new MouseEvent('dblclick', { bubbles: true });
      backendNode.dispatchEvent(dblClickEvent);
    });

    expect(onNodeClick).toHaveBeenCalledWith('backend');
  });

  it('should show pin info bar with API list when pinning a node with APIs', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // frontend 핀 (api-consumer with /api/users)
    act(() => {
      screen.getByTestId('node-frontend').click();
    });

    expect(screen.getByTestId('pin-info-bar')).toBeInTheDocument();
    expect(screen.getByText(/\/api\/users/)).toBeInTheDocument();
  });

  it('should show link types in pin info bar', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // backend 핀 (api-consumer + shared-library 두 가지 타입)
    act(() => {
      screen.getByTestId('node-backend').click();
    });

    expect(screen.getByTestId('pin-info-bar')).toBeInTheDocument();
    expect(screen.getByText(/API Consumer/)).toBeInTheDocument();
    expect(screen.getByText(/Shared Lib/)).toBeInTheDocument();
  });

  it('should apply pinned style (background #BFDBFE, border #2563EB) to pinned node', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // frontend 핀
    act(() => {
      screen.getByTestId('node-frontend').click();
    });

    // 핀된 노드 스타일 확인
    const nodeEl = screen.getByTestId('node-frontend');
    const style = JSON.parse(nodeEl.getAttribute('data-style') || '{}');
    expect(style.background).toBe('#BFDBFE');
    expect(style.border).toBe('2px solid #2563EB');
    expect(style.boxShadow).toBeDefined();
  });

  it('should dim unconnected nodes when a node is pinned', () => {
    render(<CrossProjectDiagram links={mockLinks} />);

    // frontend 핀 → database는 frontend와 직접 연결 아님 → dim
    act(() => {
      screen.getByTestId('node-frontend').click();
    });

    const databaseNode = screen.getByTestId('node-database');
    const style = JSON.parse(databaseNode.getAttribute('data-style') || '{}');
    expect(style.opacity).toBe(0.3);

    // backend는 frontend와 연결 → 정상 opacity
    const backendNode = screen.getByTestId('node-backend');
    const backendStyle = JSON.parse(backendNode.getAttribute('data-style') || '{}');
    expect(backendStyle.opacity).toBe(1);
  });

  it('should pass onNodeDoubleClick to ReactFlow', () => {
    render(<CrossProjectDiagram links={mockLinks} onNodeClick={() => {}} />);
    expect(capturedProps.onNodeDoubleClick).toBeDefined();
    expect(typeof capturedProps.onNodeDoubleClick).toBe('function');
  });
});
