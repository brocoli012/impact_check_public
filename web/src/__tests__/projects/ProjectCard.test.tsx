/**
 * @module web/__tests__/projects/ProjectCard.test
 * @description ProjectCard 컴포넌트 단위 테스트 - REQ-012
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProjectCard from '../../components/projects/ProjectCard';
import type { ProjectInfo } from '../../types';

const mockProject: ProjectInfo = {
  id: 'test-project',
  name: 'Test Project',
  path: '/tmp/test',
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z',
  lastUsedAt: '2025-03-01T00:00:00Z',
  techStack: ['react', 'typescript', 'tailwind', 'zustand', 'extra'],
  resultCount: 3,
  latestGrade: 'High',
  latestScore: 45,
  latestAnalyzedAt: '2025-03-01T10:00:00Z',
  taskCount: 5,
  policyWarningCount: 2,
};

describe('ProjectCard', () => {
  it('should render project name', () => {
    render(<ProjectCard project={mockProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('Test Project')).toBeTruthy();
  });

  it('should render grade badge', () => {
    render(<ProjectCard project={mockProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('should render stats (resultCount, taskCount, policyWarningCount)', () => {
    render(<ProjectCard project={mockProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('3')).toBeTruthy();  // resultCount
    expect(screen.getByText('5')).toBeTruthy();  // taskCount
    expect(screen.getByText('2')).toBeTruthy();  // policyWarningCount
  });

  it('should render tech stack tags (max 4)', () => {
    render(<ProjectCard project={mockProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('react')).toBeTruthy();
    expect(screen.getByText('typescript')).toBeTruthy();
    expect(screen.getByText('tailwind')).toBeTruthy();
    expect(screen.getByText('zustand')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy(); // 5번째 기술은 +1로 표시
  });

  it('should show active indicator when isActive=true', () => {
    const { container } = render(<ProjectCard project={mockProject} isActive={true} onClick={() => {}} />);
    // 활성 프로젝트는 purple 테두리
    const card = container.querySelector('[data-testid="project-card-test-project"]');
    expect(card?.className).toContain('border-purple-500');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ProjectCard project={mockProject} isActive={false} onClick={handleClick} />);

    const card = screen.getByTestId('project-card-test-project');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledWith('test-project');
  });

  it('should call onClick on Enter key', () => {
    const handleClick = vi.fn();
    render(<ProjectCard project={mockProject} isActive={false} onClick={handleClick} />);

    const card = screen.getByTestId('project-card-test-project');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith('test-project');
  });

  it('should render "-" badge when no grade', () => {
    const noGradeProject = { ...mockProject, latestGrade: null, latestScore: null };
    render(<ProjectCard project={noGradeProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('-')).toBeTruthy();
  });

  it('should show "분석 결과 없음" when no latestAnalyzedAt', () => {
    const noResultProject = { ...mockProject, latestAnalyzedAt: null };
    render(<ProjectCard project={noResultProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('분석 결과 없음')).toBeTruthy();
  });

  it('should show "보관됨" badge for archived projects', () => {
    const archivedProject = { ...mockProject, status: 'archived' as const };
    render(<ProjectCard project={archivedProject} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('보관됨')).toBeTruthy();
  });

  // --------------------------------------------------------
  // TASK-113: 도메인 태그 렌더링 테스트
  // --------------------------------------------------------
  describe('domain tags (TASK-113)', () => {
    it('should render domain tags when domains are provided', () => {
      const projectWithDomains: ProjectInfo = {
        ...mockProject,
        domains: ['주문', '결제', '배송'],
      };
      render(<ProjectCard project={projectWithDomains} isActive={false} onClick={() => {}} />);

      expect(screen.getByText('주문')).toBeTruthy();
      expect(screen.getByText('결제')).toBeTruthy();
      expect(screen.getByText('배송')).toBeTruthy();
    });

    it('should limit domain tags to 3 and show overflow count', () => {
      const projectWithManyDomains: ProjectInfo = {
        ...mockProject,
        domains: ['주문', '결제', '배송', '상품', '회원'],
      };
      render(<ProjectCard project={projectWithManyDomains} isActive={false} onClick={() => {}} />);

      // 처음 3개만 표시
      expect(screen.getByText('주문')).toBeTruthy();
      expect(screen.getByText('결제')).toBeTruthy();
      expect(screen.getByText('배송')).toBeTruthy();
      // 나머지 +2 표시
      expect(screen.getByText('+2')).toBeTruthy();
      // 4번째, 5번째는 태그로 표시되지 않음
      expect(screen.queryByText('상품')).toBeNull();
      expect(screen.queryByText('회원')).toBeNull();
    });

    it('should not render domain section when domains is empty', () => {
      const projectNoDomains: ProjectInfo = {
        ...mockProject,
        domains: [],
      };
      const { container } = render(<ProjectCard project={projectNoDomains} isActive={false} onClick={() => {}} />);

      // 도메인 태그 섹션이 렌더링되지 않아야 함
      // 도메인 태그는 rounded-full 클래스를 가짐
      const domainTags = container.querySelectorAll('.rounded-full');
      expect(domainTags.length).toBe(0);
    });

    it('should not render domain section when domains is undefined', () => {
      const projectUndefinedDomains: ProjectInfo = {
        ...mockProject,
        domains: undefined,
      };
      render(<ProjectCard project={projectUndefinedDomains} isActive={false} onClick={() => {}} />);

      // domains가 undefined일 때도 에러 없이 렌더링
      expect(screen.getByText('Test Project')).toBeTruthy();
    });
  });
});
