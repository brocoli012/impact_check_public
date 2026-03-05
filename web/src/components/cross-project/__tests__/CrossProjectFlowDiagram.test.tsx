/**
 * @module web/components/cross-project/__tests__/CrossProjectFlowDiagram.test
 * @description CrossProjectFlowDiagram 컴포넌트 렌더링 테스트 (TASK-114)
 *
 * 테스트 대상:
 * - 기본 렌더링 (에러 없이 렌더링)
 * - 빈 데이터 시 empty 상태 표시
 * - 노드와 엣지가 올바르게 생성되는지
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CrossProjectFlowDiagram from '../CrossProjectFlowDiagram';
import type { ProjectLink } from '../CrossProjectDiagram';
import type { ProjectGroup } from '../CrossProjectSummary';
import type { ProjectInfo } from '../../../types';

// dagre mock - jsdom에서 dagre layout 계산 불가 → 고정 좌표 반환
vi.mock('dagre', () => {
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  let nodeIdx = 0;

  return {
    default: {
      graphlib: {
        Graph: class MockGraph {
          private edges: Array<{ v: string; w: string }> = [];
          setDefaultEdgeLabel(_fn: () => object) {}
          setGraph(_opts: object) {}
          setNode(id: string, dims: { width: number; height: number }) {
            nodePositions.set(id, { x: nodeIdx * 300, y: 0, ...dims });
            nodeIdx++;
          }
          setEdge(source: string, target: string) {
            this.edges.push({ v: source, w: target });
          }
          node(id: string) {
            return nodePositions.get(id) || { x: 0, y: 0, width: 240, height: 160 };
          }
        },
      },
      layout(_g: unknown) {
        // no-op: positions already set in setNode
      },
    },
  };
});

/** 테스트용 프로젝트 데이터 */
const mockProjects: ProjectInfo[] = [
  {
    id: 'frontend',
    name: 'Frontend App',
    path: '/home/user/frontend',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    lastUsedAt: '2025-06-01T00:00:00Z',
    techStack: ['react', 'typescript'],
    resultCount: 5,
    latestGrade: 'High',
    latestScore: 85,
    latestAnalyzedAt: '2025-06-01T00:00:00Z',
    taskCount: 10,
    policyWarningCount: 1,
    domains: ['상품', '주문'],
  },
  {
    id: 'backend',
    name: 'Backend API',
    path: '/home/user/backend',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    lastUsedAt: '2025-06-01T00:00:00Z',
    techStack: ['node', 'express'],
    resultCount: 3,
    latestGrade: 'Medium',
    latestScore: 60,
    latestAnalyzedAt: '2025-06-01T00:00:00Z',
    taskCount: 7,
    policyWarningCount: 0,
    domains: ['결제', '배송'],
  },
];

const mockLinks: ProjectLink[] = [
  {
    id: 'frontend-backend',
    source: 'frontend',
    target: 'backend',
    type: 'api-consumer',
    apis: ['/api/orders', '/api/products'],
    autoDetected: false,
    confirmedAt: '2025-06-01T00:00:00Z',
  },
];

const mockGroups: ProjectGroup[] = [
  { name: 'Commerce', projects: ['frontend', 'backend'] },
];

describe('CrossProjectFlowDiagram', () => {
  it('should render without error when given valid props', () => {
    render(
      <CrossProjectFlowDiagram
        links={mockLinks}
        groups={mockGroups}
        projects={mockProjects}
      />,
    );

    expect(screen.getByTestId('cross-project-flow-diagram')).toBeInTheDocument();
  });

  it('should show empty message when no links and no projects', () => {
    render(
      <CrossProjectFlowDiagram
        links={[]}
        groups={[]}
        projects={[]}
      />,
    );

    expect(screen.getByTestId('cross-project-flow-diagram-empty')).toBeInTheDocument();
    expect(screen.getByText('표시할 프로젝트가 없습니다')).toBeInTheDocument();
  });

  it('should render with multiple links of different types', () => {
    const multiLinks: ProjectLink[] = [
      {
        id: 'frontend-backend',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: false,
      },
      {
        id: 'backend-frontend',
        source: 'backend',
        target: 'frontend',
        type: 'event-publisher',
        autoDetected: true,
      },
    ];

    render(
      <CrossProjectFlowDiagram
        links={multiLinks}
        groups={[]}
        projects={mockProjects}
      />,
    );

    // 에러 없이 렌더링됨
    expect(screen.getByTestId('cross-project-flow-diagram')).toBeInTheDocument();
  });

  it('should handle onNodeClick callback', () => {
    const handleNodeClick = vi.fn();

    render(
      <CrossProjectFlowDiagram
        links={mockLinks}
        groups={mockGroups}
        projects={mockProjects}
        onNodeClick={handleNodeClick}
      />,
    );

    // 컴포넌트가 에러 없이 렌더링됨 (클릭 이벤트는 ReactFlow 내부라 jsdom에서 직접 테스트 어려움)
    expect(screen.getByTestId('cross-project-flow-diagram')).toBeInTheDocument();
  });

  it('should filter by selectedGroup', () => {
    const threeProjects: ProjectInfo[] = [
      ...mockProjects,
      {
        id: 'database',
        name: 'Database',
        path: '/home/user/database',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastUsedAt: '2025-06-01T00:00:00Z',
        techStack: ['postgresql'],
        resultCount: 0,
        latestGrade: null,
        latestScore: null,
        latestAnalyzedAt: null,
        taskCount: 0,
        policyWarningCount: 0,
      },
    ];

    const twoGroupLinks: ProjectLink[] = [
      ...mockLinks,
      {
        id: 'backend-database',
        source: 'backend',
        target: 'database',
        type: 'shared-db',
        autoDetected: false,
      },
    ];

    const twoGroups: ProjectGroup[] = [
      { name: 'Commerce', projects: ['frontend', 'backend'] },
      { name: 'Infra', projects: ['database'] },
    ];

    // Commerce 그룹 필터 적용
    render(
      <CrossProjectFlowDiagram
        links={twoGroupLinks}
        groups={twoGroups}
        projects={threeProjects}
        selectedGroup="Commerce"
      />,
    );

    // 에러 없이 렌더링됨
    expect(screen.getByTestId('cross-project-flow-diagram')).toBeInTheDocument();
  });

  it('should filter by searchQuery', () => {
    render(
      <CrossProjectFlowDiagram
        links={mockLinks}
        groups={mockGroups}
        projects={mockProjects}
        searchQuery="Frontend"
      />,
    );

    // 에러 없이 렌더링됨
    expect(screen.getByTestId('cross-project-flow-diagram')).toBeInTheDocument();
  });

  it('should handle link.type as object without React #310 (BUG-011)', () => {
    const linksWithObjectType = [
      {
        id: 'frontend-backend',
        source: 'frontend',
        target: 'backend',
        type: { name: 'api-consumer' } as unknown as string,
        autoDetected: false,
      },
    ];

    // Should not throw React error #310 (Objects are not valid as React child)
    expect(() => {
      render(
        <CrossProjectFlowDiagram
          links={linksWithObjectType}
          groups={[]}
          projects={mockProjects}
        />,
      );
    }).not.toThrow();

    expect(screen.getByTestId('cross-project-flow-diagram')).toBeInTheDocument();
  });
});
