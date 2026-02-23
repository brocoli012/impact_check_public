/**
 * @module web/pages/__tests__/ProjectBoard.test
 * @description TASK-139: ProjectBoard 페이지 통합 테스트
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectBoard from '../ProjectBoard';
import { useProjectStore } from '../../stores/projectStore';
import { useResultStore } from '../../stores/resultStore';
import { usePolicyStore } from '../../stores/policyStore';
import { useSharedEntityStore } from '../../stores/sharedEntityStore';
import type { ProjectInfo, ResultSummary, Policy } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

/** BrowserRouter 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/* ------------------------------------------------------------------ */
/*  Mock 데이터                                                        */
/* ------------------------------------------------------------------ */

const mockProjects: ProjectInfo[] = [
  {
    id: 'proj-1',
    name: 'Test Project',
    path: '/path/to/project',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsedAt: '2026-02-20T00:00:00Z',
    techStack: ['React', 'TypeScript'],
    resultCount: 3,
    latestGrade: 'Medium',
    latestScore: 55,
    latestAnalyzedAt: '2026-02-20T00:00:00Z',
    taskCount: 8,
    policyWarningCount: 1,
  },
];

const mockResults: ResultSummary[] = [
  {
    id: 'r-1',
    specTitle: '기획서 Alpha',
    analyzedAt: '2026-02-20T10:00:00Z',
    totalScore: 65,
    grade: 'High',
    affectedScreenCount: 3,
    taskCount: 5,
  },
  {
    id: 'r-2',
    specTitle: '기획서 Beta',
    analyzedAt: '2026-02-18T10:00:00Z',
    totalScore: 40,
    grade: 'Medium',
    affectedScreenCount: 2,
    taskCount: 3,
  },
];

const mockPolicies: Policy[] = [
  {
    id: 'pol-1',
    name: 'Test Policy',
    category: 'security',
    description: 'Test policy description',
    confidence: 0.8,
    affectedFiles: ['file1.ts'],
    relatedTaskIds: ['t-1'],
    source: 'comment',
  },
];

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

function setupStores(options?: {
  projects?: ProjectInfo[];
  results?: ResultSummary[];
  policies?: Policy[];
  hasIndex?: boolean;
  hasResults?: boolean;
}) {
  const {
    projects = mockProjects,
    results = mockResults,
    policies = mockPolicies,
    hasIndex = true,
    hasResults = true,
  } = options || {};

  useProjectStore.setState({
    projects,
    activeProjectId: projects.length > 0 ? projects[0].id : null,
    isLoading: false,
    error: null,
  });

  useResultStore.setState({
    currentResult: null,
    resultList: results,
    isLoading: false,
    error: null,
  });

  usePolicyStore.setState({
    policies,
    loading: false,
    error: null,
  });

  useSharedEntityStore.setState({
    tables: [],
    events: [],
    stats: null,
    searchResult: null,
    isLoading: false,
    error: null,
  });

  // Mock fetch responses
  vi.mocked(fetch).mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.includes('/api/project/status')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            projectId: projects.length > 0 ? projects[0].id : null,
            projectPath: projects.length > 0 ? projects[0].path : null,
            hasIndex,
            hasAnnotations: false,
            hasResults,
          }),
      } as Response);
    }
    if (urlStr.includes('/api/project/index-meta')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            meta: hasIndex
              ? {
                  stats: {
                    totalFiles: 100,
                    screens: 10,
                    components: 30,
                    apiEndpoints: 20,
                    modules: 5,
                  },
                }
              : null,
          }),
      } as Response);
    }
    if (urlStr.includes('/api/cross-project/links')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ links: [] }),
      } as Response);
    }
    if (urlStr.includes('/api/cross-project/groups')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ groups: [] }),
      } as Response);
    }
    if (urlStr.includes('/api/shared-entities')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ tables: [], events: [], stats: null }),
      } as Response);
    }
    if (urlStr.includes('/api/projects')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            projects,
            activeProject: projects.length > 0 ? projects[0].id : null,
          }),
      } as Response);
    }
    if (urlStr.includes('/api/results')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results }),
      } as Response);
    }
    if (urlStr.includes('/api/gap-check')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            gaps: [],
            summary: { total: 0, high: 0, medium: 0, low: 0, fixable: 0 },
            checkedAt: new Date().toISOString(),
          }),
      } as Response);
    }
    if (urlStr.includes('/api/policies')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ policies, categories: [], total: policies.length }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ProjectBoard', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  describe('ProjectSelector rendering', () => {
    it('should render ProjectSelector component', async () => {
      setupStores();
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
      });
    });
  });

  describe('Quick analysis link', () => {
    it('should render "기획 분석" link to /analysis', async () => {
      setupStores();
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        const link = screen.getByTestId('quick-analysis-link');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/analysis');
      });
    });
  });

  describe('ProjectStatusBanner', () => {
    it('should display ProjectStatusBanner when project exists', async () => {
      setupStores();
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        expect(screen.getByTestId('project-status-banner')).toBeInTheDocument();
      });

      // "Test Project" 텍스트가 배너 내에 존재하는지 확인 (ProjectSelector에도 있으므로 testid 내부에서 확인)
      const banner = screen.getByTestId('project-status-banner');
      expect(banner.textContent).toContain('Test Project');
    });
  });

  describe('AnalysisHistoryTable', () => {
    it('should display AnalysisHistoryTable when results exist', async () => {
      setupStores();
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        expect(screen.getByTestId('analysis-history-table')).toBeInTheDocument();
      });

      expect(screen.getByText('기획서 Alpha')).toBeInTheDocument();
      expect(screen.getByText('기획서 Beta')).toBeInTheDocument();
    });
  });

  describe('Empty states', () => {
    it('should display empty project state when no projects', async () => {
      setupStores({ projects: [], results: [], policies: [] });
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-no-project')).toBeInTheDocument();
      });

      expect(screen.getByText('프로젝트를 등록하세요')).toBeInTheDocument();
    });

    it('should display empty analysis state when no results but has index', async () => {
      setupStores({ results: [], hasIndex: true, hasResults: false });
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        expect(screen.getByTestId('analysis-history-empty')).toBeInTheDocument();
      });

      expect(screen.getByText('아직 분석 결과가 없습니다.')).toBeInTheDocument();
    });

    it('should display no-index warning when index is missing', async () => {
      setupStores({ hasIndex: false, hasResults: false, results: [] });
      renderWithRouter(<ProjectBoard />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-no-index')).toBeInTheDocument();
      });
    });
  });
});
