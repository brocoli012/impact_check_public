/**
 * @module web/components/project-board/__tests__/ProjectStatusBanner.test
 * @description TASK-139: ProjectStatusBanner 단위 테스트
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProjectStatusBanner from '../ProjectStatusBanner';
import type { ProjectInfo } from '../../../types';

const mockProject: ProjectInfo = {
  id: 'proj-1',
  name: 'Test Project',
  path: '/Users/test/project',
  status: 'active',
  createdAt: '2026-01-15T00:00:00Z',
  lastUsedAt: '2026-02-20T00:00:00Z',
  techStack: ['React', 'TypeScript', 'Node.js'],
  resultCount: 5,
  latestGrade: 'Medium',
  latestScore: 55,
  latestAnalyzedAt: '2026-02-20T00:00:00Z',
  taskCount: 10,
  policyWarningCount: 2,
};

const mockIndexMeta = {
  totalFiles: 120,
  screens: 15,
  components: 45,
  apis: 30,
  modules: 8,
};

describe('ProjectStatusBanner', () => {
  it('should render project name and path', () => {
    render(
      <ProjectStatusBanner project={mockProject} indexMeta={mockIndexMeta} />,
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('/Users/test/project')).toBeInTheDocument();
  });

  it('should render tech stack tags', () => {
    render(
      <ProjectStatusBanner project={mockProject} indexMeta={mockIndexMeta} />,
    );

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
  });

  it('should render active status badge', () => {
    render(
      <ProjectStatusBanner project={mockProject} indexMeta={mockIndexMeta} />,
    );

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveTextContent('활성');
  });

  it('should render archived status badge', () => {
    const archivedProject = { ...mockProject, status: 'archived' as const };
    render(
      <ProjectStatusBanner project={archivedProject} indexMeta={mockIndexMeta} />,
    );

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveTextContent('보관됨');
  });

  it('should render index meta stats when provided', () => {
    render(
      <ProjectStatusBanner project={mockProject} indexMeta={mockIndexMeta} />,
    );

    expect(screen.getByText('120')).toBeInTheDocument(); // totalFiles
    expect(screen.getByText('15')).toBeInTheDocument(); // screens
    expect(screen.getByText('45')).toBeInTheDocument(); // components
    expect(screen.getByText('30')).toBeInTheDocument(); // apis
    expect(screen.getByText('8')).toBeInTheDocument(); // modules
  });

  it('should show index warning when indexMeta is null', () => {
    render(
      <ProjectStatusBanner project={mockProject} indexMeta={null} />,
    );

    const warning = screen.getByTestId('index-warning');
    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toContain('인덱싱이 필요합니다');
  });

  it('should render last analysis date when provided', () => {
    render(
      <ProjectStatusBanner
        project={mockProject}
        indexMeta={mockIndexMeta}
        lastAnalysisDate="2026-02-20T00:00:00Z"
      />,
    );

    // 날짜 포맷 (한국어 로케일 - '2026. 02. 20.' 형태)
    const banner = screen.getByTestId('project-status-banner');
    expect(banner.textContent).toContain('마지막 분석');
  });

  it('should render dash for last analysis when not provided', () => {
    render(
      <ProjectStatusBanner project={mockProject} indexMeta={mockIndexMeta} />,
    );

    const banner = screen.getByTestId('project-status-banner');
    expect(banner.textContent).toContain('마지막 분석: -');
  });

  it('should not render tech stack section when empty', () => {
    const noTechProject = { ...mockProject, techStack: [] };
    render(
      <ProjectStatusBanner project={noTechProject} indexMeta={mockIndexMeta} />,
    );

    // No tech tags rendered
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  // --------------------------------------------------------
  // TASK-113: 도메인 태그 및 기능 요약 렌더링 테스트
  // --------------------------------------------------------
  describe('domain tags and feature summary (TASK-113)', () => {
    it('should render domain tags when domains are provided', () => {
      const projectWithDomains: ProjectInfo = {
        ...mockProject,
        domains: ['주문', '결제', '상품'],
      };
      render(
        <ProjectStatusBanner project={projectWithDomains} indexMeta={mockIndexMeta} />,
      );

      expect(screen.getByText('주문')).toBeInTheDocument();
      expect(screen.getByText('결제')).toBeInTheDocument();
      expect(screen.getByText('상품')).toBeInTheDocument();
    });

    it('should not render domain tags when domains is empty', () => {
      const projectNoDomains: ProjectInfo = {
        ...mockProject,
        domains: [],
      };
      render(
        <ProjectStatusBanner project={projectNoDomains} indexMeta={mockIndexMeta} />,
      );

      // 도메인 키워드가 표시되지 않아야 함
      expect(screen.queryByText('주문')).not.toBeInTheDocument();
    });

    it('should not render domain tags when domains is undefined', () => {
      const projectUndefinedDomains: ProjectInfo = {
        ...mockProject,
        domains: undefined,
      };
      render(
        <ProjectStatusBanner project={projectUndefinedDomains} indexMeta={mockIndexMeta} />,
      );

      // 에러 없이 렌더링되어야 함
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should render feature summary when featureSummary is provided', () => {
      const projectWithFeatures: ProjectInfo = {
        ...mockProject,
        featureSummary: [
          '주문 OrderList/OrderDetail (화면 2개, API 3개)',
          '결제 PaymentPage (화면 1개, API 2개)',
        ],
      };
      render(
        <ProjectStatusBanner project={projectWithFeatures} indexMeta={mockIndexMeta} />,
      );

      // "주요 기능" 헤더가 표시되어야 함
      expect(screen.getByText('주요 기능')).toBeInTheDocument();
    });

    it('should not render feature summary section when featureSummary is empty', () => {
      const projectNoFeatures: ProjectInfo = {
        ...mockProject,
        featureSummary: [],
      };
      render(
        <ProjectStatusBanner project={projectNoFeatures} indexMeta={mockIndexMeta} />,
      );

      // "주요 기능" 섹션이 표시되지 않아야 함
      expect(screen.queryByText('주요 기능')).not.toBeInTheDocument();
    });

    it('should limit feature summary display to 4 items with overflow', () => {
      const projectManyFeatures: ProjectInfo = {
        ...mockProject,
        featureSummary: [
          '주문 기능 1',
          '결제 기능 2',
          '배송 기능 3',
          '상품 기능 4',
          '회원 기능 5',
          '검색 기능 6',
        ],
      };
      render(
        <ProjectStatusBanner project={projectManyFeatures} indexMeta={mockIndexMeta} />,
      );

      // 최대 4개까지 표시, +2개 기능 오버플로우 표시
      expect(screen.getByText('+2개 기능')).toBeInTheDocument();
    });
  });
});
