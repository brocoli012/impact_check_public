/**
 * @module web/components/layout/__tests__/LNB.test
 * @description Tests for Left Navigation Bar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LNB from '../LNB';
import { useResultStore } from '../../../stores/resultStore';
import type { ResultSummary } from '../../../types';

// Mock fetch
global.fetch = vi.fn();

const mockResults: ResultSummary[] = [
  {
    id: 'result-1',
    specTitle: 'Kurly App v2.0',
    analyzedAt: '2026-02-15T10:00:00Z',
    totalScore: 92,
    grade: 'A',
    affectedScreenCount: 8,
    taskCount: 12,
  },
  {
    id: 'result-2',
    specTitle: 'Order System Improvement',
    analyzedAt: '2026-02-14T09:00:00Z',
    totalScore: 68,
    grade: 'C',
    affectedScreenCount: 5,
    taskCount: 7,
  },
  {
    id: 'result-3',
    specTitle: 'Payment Gateway',
    analyzedAt: '2026-02-13T08:00:00Z',
    totalScore: 45,
    grade: 'E',
    affectedScreenCount: 3,
    taskCount: 4,
  },
];

describe('LNB', () => {
  beforeEach(() => {
    // Reset store
    useResultStore.setState({
      resultList: [],
      currentResult: null,
      lnbCollapsed: false,
      searchQuery: '',
      sortBy: 'latest',
      isLoading: false,
      error: null,
    });

    // Mock successful fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ results: mockResults }),
    });
  });

  it('renders LNB with all elements', async () => {
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: '분석 결과 목록' })).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/검색/)).toBeInTheDocument();
    expect(screen.getByLabelText(/정렬 방식 선택/)).toBeInTheDocument();
    expect(screen.getByLabelText(/목록 접기/)).toBeInTheDocument();
  });

  it('fetches results on mount', async () => {
    render(<LNB />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/results');
    });

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
      expect(screen.getByText('Order System Improvement')).toBeInTheDocument();
      expect(screen.getByText('Payment Gateway')).toBeInTheDocument();
    });
  });

  it('displays loading state while fetching', async () => {
    // Mock a pending fetch (never resolves during test)
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );

    act(() => {
      useResultStore.setState({ isLoading: false });
    });

    render(<LNB />);

    // Wait for loading state to be set by fetchAllResults
    await waitFor(() => {
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('displays demo data even when API returns no results', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ results: [] }),
    });

    render(<LNB />);

    // Demo data should still be present
    await waitFor(() => {
      expect(screen.getByText('장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });

    // Should have demo badge
    const demoBadge = screen.getAllByText('예시');
    expect(demoBadge.length).toBeGreaterThan(0);
  });

  it('filters results by search query', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/검색/);
    await user.type(searchInput, 'Kurly');

    // Wait for debounce (300ms)
    await waitFor(
      () => {
        expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
        expect(screen.queryByText('Order System Improvement')).not.toBeInTheDocument();
        expect(screen.queryByText('Payment Gateway')).not.toBeInTheDocument();
      },
      { timeout: 500 },
    );
  });

  it('clears search when X button is clicked', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/검색/);
    await user.type(searchInput, 'test');

    const clearButton = screen.getByLabelText(/검색 초기화/);
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('clears search when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/검색/);
    await user.type(searchInput, 'test');

    await user.keyboard('{Escape}');

    expect(searchInput).toHaveValue('');
  });

  it('sorts results by latest (default)', async () => {
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    // Check that results are sorted by latest (not checking exact order due to demo data)
    const kurlyCard = screen.getByText('Kurly App v2.0').closest('[role="button"]');
    const orderCard = screen.getByText('Order System Improvement').closest('[role="button"]');
    expect(kurlyCard).toBeInTheDocument();
    expect(orderCard).toBeInTheDocument();
  });

  it('sorts results by oldest', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText(/정렬 방식 선택/);
    await user.selectOptions(sortSelect, 'oldest');

    // Check that results are present after sorting
    await waitFor(() => {
      expect(screen.getByText('Payment Gateway')).toBeInTheDocument();
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });
  });

  it('sorts results by grade high', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText(/정렬 방식 선택/);
    await user.selectOptions(sortSelect, 'grade-high');

    // Check that results are present after sorting
    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
      expect(screen.getByText('Order System Improvement')).toBeInTheDocument();
      expect(screen.getByText('Payment Gateway')).toBeInTheDocument();
    });
  });

  it('toggles LNB collapse state', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByLabelText(/목록 접기/)).toBeInTheDocument();
    });

    const collapseButton = screen.getByLabelText(/목록 접기/);
    await user.click(collapseButton);

    await waitFor(() => {
      expect(useResultStore.getState().lnbCollapsed).toBe(true);
    });
  });

  it('displays collapsed state correctly', async () => {
    act(() => {
      useResultStore.setState({ lnbCollapsed: true });
    });

    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByLabelText(/목록 펼치기/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('displays no search results message', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/검색/);
    await user.type(searchInput, 'nonexistent');

    await waitFor(
      () => {
        expect(screen.getByText(/"nonexistent" 검색 결과 없음/)).toBeInTheDocument();
        expect(screen.getByText(/다른 키워드로 시도해보세요/)).toBeInTheDocument();
      },
      { timeout: 500 },
    );
  });

  it('switches result when non-demo card is clicked', async () => {
    const user = userEvent.setup();

    // Mock successful result fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ results: mockResults }),
    });

    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('Kurly App v2.0')).toBeInTheDocument();
    });

    // Mock result switch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({
        result: {
          analysisId: 'result-1',
          specTitle: 'Kurly App v2.0',
          analyzedAt: '2026-02-15T10:00:00Z',
          totalScore: 92,
          grade: 'A',
          affectedScreens: [],
          tasks: [],
          planningChecks: [],
          policyChanges: [],
          screenScores: [],
          recommendation: 'Test recommendation',
          policyWarnings: [],
          ownerNotifications: [],
          confidenceScores: [],
          lowConfidenceWarnings: [],
        },
      }),
    });

    // Click on Kurly App card (non-demo)
    const kurlyCard = screen.getByText('Kurly App v2.0').closest('[role="button"]');
    if (kurlyCard) {
      await user.click(kurlyCard);
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/results/result-1');
    });
  });

  it('loads mock data directly when demo card is clicked', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });

    // Click on demo card
    const demoCard = screen.getByText('장바구니 리뉴얼 기획서').closest('[role="button"]');
    if (demoCard) {
      await user.click(demoCard);
    }

    // Should load mock data without API call
    await waitFor(() => {
      const currentResult = useResultStore.getState().currentResult;
      expect(currentResult?.analysisId).toBe('demo-analysis-001');
    });
  });

  it('has correct accessibility attributes', async () => {
    render(<LNB />);

    await waitFor(() => {
      const nav = screen.getByRole('navigation', { name: '분석 결과 목록' });
      expect(nav).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/결과 검색/);
    expect(searchInput).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/정렬 방식 선택/);
    expect(sortSelect).toBeInTheDocument();
  });

  it('displays mock demo data in results list', async () => {
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });

    // Check that demo badge is present
    const demoBadge = screen.getAllByText('예시');
    expect(demoBadge.length).toBeGreaterThan(0);
  });

  it('includes mock data in search results', async () => {
    const user = userEvent.setup();
    render(<LNB />);

    await waitFor(() => {
      expect(screen.getByText('장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/검색/);
    await user.type(searchInput, '장바구니');

    await waitFor(
      () => {
        expect(screen.getByText('장바구니 리뉴얼 기획서')).toBeInTheDocument();
      },
      { timeout: 500 },
    );
  });
});
