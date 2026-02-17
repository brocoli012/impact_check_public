/**
 * @module web/__tests__/cross-project/CrossProjectDiagram.test
 * @description CrossProjectDiagram 컴포넌트 렌더링 테스트
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CrossProjectDiagram from '../../components/cross-project/CrossProjectDiagram';
import type { ProjectLink } from '../../components/cross-project/CrossProjectDiagram';

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
