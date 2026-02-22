/**
 * @module web/components/project-board/__tests__/AnalysisHistoryTable.test
 * @description TASK-139: AnalysisHistoryTable 단위 테스트
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import AnalysisHistoryTable from '../AnalysisHistoryTable';
import type { ResultSummary } from '../../../types';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

const mockResults: ResultSummary[] = [
  {
    id: 'r-1',
    specTitle: '기획서 A',
    analyzedAt: '2026-02-20T10:00:00Z',
    totalScore: 75,
    grade: 'High',
    affectedScreenCount: 3,
    taskCount: 5,
  },
  {
    id: 'r-2',
    specTitle: '기획서 B',
    analyzedAt: '2026-02-18T10:00:00Z',
    totalScore: 45,
    grade: 'Medium',
    affectedScreenCount: 2,
    taskCount: 3,
  },
  {
    id: 'r-3',
    specTitle: '기획서 C',
    analyzedAt: '2026-02-15T10:00:00Z',
    totalScore: 20,
    grade: 'Low',
    affectedScreenCount: 1,
    taskCount: 1,
  },
];

describe('AnalysisHistoryTable', () => {
  it('should render table with results', () => {
    renderWithRouter(<AnalysisHistoryTable results={mockResults} />);

    expect(screen.getByTestId('analysis-history-table')).toBeInTheDocument();
    expect(screen.getByText('최근 분석 이력')).toBeInTheDocument();
  });

  it('should render result rows', () => {
    renderWithRouter(<AnalysisHistoryTable results={mockResults} />);

    expect(screen.getByText('기획서 A')).toBeInTheDocument();
    expect(screen.getByText('기획서 B')).toBeInTheDocument();
    expect(screen.getByText('기획서 C')).toBeInTheDocument();
  });

  it('should display grade badges', () => {
    renderWithRouter(<AnalysisHistoryTable results={mockResults} />);

    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('should display scores', () => {
    renderWithRouter(<AnalysisHistoryTable results={mockResults} />);

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('should show "전체 보기" link', () => {
    renderWithRouter(<AnalysisHistoryTable results={mockResults} />);

    const link = screen.getByText(/전체 보기/);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/analysis');
  });

  it('should limit rows to maxItems', () => {
    renderWithRouter(<AnalysisHistoryTable results={mockResults} maxItems={2} />);

    expect(screen.getByText('기획서 A')).toBeInTheDocument();
    expect(screen.getByText('기획서 B')).toBeInTheDocument();
    expect(screen.queryByText('기획서 C')).not.toBeInTheDocument();
  });

  it('should render empty state when no results', () => {
    renderWithRouter(<AnalysisHistoryTable results={[]} />);

    expect(screen.getByTestId('analysis-history-empty')).toBeInTheDocument();
    expect(screen.getByText('아직 분석 결과가 없습니다.')).toBeInTheDocument();
  });

  it('should show CTA link in empty state', () => {
    renderWithRouter(<AnalysisHistoryTable results={[]} />);

    const cta = screen.getByTestId('analysis-history-cta');
    expect(cta).toBeInTheDocument();
    expect(cta.closest('a')).toHaveAttribute('href', '/analysis');
  });

  it('should show CLI hint in empty state', () => {
    renderWithRouter(<AnalysisHistoryTable results={[]} />);

    expect(screen.getByText(/node dist\/index\.js analyze/)).toBeInTheDocument();
  });
});
