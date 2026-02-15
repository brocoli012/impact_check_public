/**
 * @module web/components/layout/__tests__/ResultCard.test
 * @description Tests for ResultCard component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultCard from '../ResultCard';
import type { ResultSummary } from '../../../types';

describe('ResultCard', () => {
  const mockResult: ResultSummary = {
    id: 'test-123',
    specTitle: 'Test Specification Title',
    analyzedAt: '2026-02-15T10:00:00Z',
    totalScore: 85,
    grade: 'A',
    affectedScreenCount: 5,
    taskCount: 10,
  };

  it('renders result card with all information', () => {
    render(<ResultCard result={mockResult} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Test Specification Title')).toBeInTheDocument();
    expect(screen.getByText('총점 85/100')).toBeInTheDocument();
    expect(screen.getByText(/영향 화면 5개/)).toBeInTheDocument();
    expect(screen.getByText(/작업 10건/)).toBeInTheDocument();
  });

  it('applies selected styling when isSelected is true', () => {
    const { container } = render(
      <ResultCard result={mockResult} isSelected={true} onClick={vi.fn()} />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('border-blue-500');
    expect(card).toHaveClass('bg-blue-50');
  });

  it('applies default styling when isSelected is false', () => {
    const { container } = render(
      <ResultCard result={mockResult} isSelected={false} onClick={vi.fn()} />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('border-transparent');
  });

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<ResultCard result={mockResult} isSelected={false} onClick={handleClick} />);

    const card = screen.getByRole('button');
    await user.click(card);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<ResultCard result={mockResult} isSelected={false} onClick={handleClick} />);

    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Space key is pressed', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<ResultCard result={mockResult} isSelected={false} onClick={handleClick} />);

    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard(' ');

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('truncates long title to 2 lines', () => {
    const longTitleResult: ResultSummary = {
      ...mockResult,
      specTitle:
        'This is a very long specification title that should be truncated to two lines maximum to ensure proper display in the result card',
    };

    render(<ResultCard result={longTitleResult} isSelected={false} onClick={vi.fn()} />);

    const title = screen.getByText(longTitleResult.specTitle);
    expect(title).toHaveClass('line-clamp-2');
  });

  it('displays correct grade color for different grades', () => {
    const grades = ['A', 'B', 'C', 'D', 'E', 'F'];

    grades.forEach((grade) => {
      const { unmount } = render(
        <ResultCard result={{ ...mockResult, grade }} isSelected={false} onClick={vi.fn()} />,
      );

      const gradeElement = screen.getByText(grade);
      expect(gradeElement).toBeInTheDocument();

      unmount();
    });
  });

  it('formats date correctly', () => {
    render(<ResultCard result={mockResult} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText(/📅 2026-02-15/)).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<ResultCard result={mockResult} isSelected={true} onClick={vi.fn()} />);

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-selected', 'true');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('displays "예시" badge when isDemo is true', () => {
    const demoResult: ResultSummary = {
      ...mockResult,
      isDemo: true,
    };

    render(<ResultCard result={demoResult} isSelected={false} onClick={vi.fn()} />);

    expect(screen.getByText('예시')).toBeInTheDocument();
  });

  it('does not display "예시" badge when isDemo is false', () => {
    render(<ResultCard result={mockResult} isSelected={false} onClick={vi.fn()} />);

    expect(screen.queryByText('예시')).not.toBeInTheDocument();
  });

  it('applies purple border style when isDemo is true', () => {
    const demoResult: ResultSummary = {
      ...mockResult,
      isDemo: true,
    };

    const { container } = render(
      <ResultCard result={demoResult} isSelected={false} onClick={vi.fn()} />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('border-purple-400');
  });
});
