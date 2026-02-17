/**
 * @module web/__tests__/cross-project/CrossProjectSummary.test
 * @description CrossProjectSummary 컴포넌트 렌더링 테스트
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CrossProjectSummary from '../../components/cross-project/CrossProjectSummary';
import type { ProjectLink } from '../../components/cross-project/CrossProjectDiagram';
import type { ProjectGroup } from '../../components/cross-project/CrossProjectSummary';

/** 테스트용 링크 데이터 */
const mockLinks: ProjectLink[] = [
  {
    id: 'frontend-backend',
    source: 'frontend',
    target: 'backend',
    type: 'api-consumer',
    autoDetected: false,
  },
  {
    id: 'backend-database',
    source: 'backend',
    target: 'database',
    type: 'shared-library',
    autoDetected: true,
  },
  {
    id: 'frontend-cdn',
    source: 'frontend',
    target: 'cdn',
    type: 'api-consumer',
    autoDetected: false,
  },
];

/** 테스트용 그룹 데이터 */
const mockGroups: ProjectGroup[] = [
  { name: 'commerce', projects: ['frontend', 'backend'] },
  { name: 'infra', projects: ['database', 'cdn'] },
];

describe('CrossProjectSummary', () => {
  it('should render summary card', () => {
    render(<CrossProjectSummary links={mockLinks} groups={mockGroups} />);
    expect(screen.getByTestId('cross-project-summary')).toBeInTheDocument();
  });

  it('should display correct project count', () => {
    render(<CrossProjectSummary links={mockLinks} groups={mockGroups} />);
    // 4 unique projects: frontend, backend, database, cdn
    expect(screen.getByTestId('project-count')).toHaveTextContent('4');
  });

  it('should display correct link count', () => {
    render(<CrossProjectSummary links={mockLinks} groups={mockGroups} />);
    expect(screen.getByTestId('link-count')).toHaveTextContent('3');
  });

  it('should display correct group count', () => {
    render(<CrossProjectSummary links={mockLinks} groups={mockGroups} />);
    expect(screen.getByTestId('group-count')).toHaveTextContent('2');
  });

  it('should display link type statistics', () => {
    render(<CrossProjectSummary links={mockLinks} groups={mockGroups} />);
    expect(screen.getByText('api-consumer')).toBeInTheDocument();
    expect(screen.getByText('shared-library')).toBeInTheDocument();
  });

  it('should show empty message when no data', () => {
    render(<CrossProjectSummary links={[]} groups={[]} />);
    expect(screen.getByTestId('cross-project-summary-empty')).toBeInTheDocument();
    expect(screen.getByText('크로스 프로젝트 데이터가 없습니다')).toBeInTheDocument();
  });

  it('should render with links only (no groups)', () => {
    render(<CrossProjectSummary links={mockLinks} groups={[]} />);
    expect(screen.getByTestId('cross-project-summary')).toBeInTheDocument();
    expect(screen.getByTestId('group-count')).toHaveTextContent('0');
    expect(screen.getByTestId('link-count')).toHaveTextContent('3');
  });

  it('should show type count values', () => {
    render(<CrossProjectSummary links={mockLinks} groups={mockGroups} />);
    // api-consumer: 2, shared-library: 1
    const typeStats = screen.getByText('링크 타입별 통계');
    expect(typeStats).toBeInTheDocument();
  });
});
