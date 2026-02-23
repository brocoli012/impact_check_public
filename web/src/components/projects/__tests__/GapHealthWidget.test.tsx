/**
 * @module web/components/projects/__tests__/GapHealthWidget.test
 * @description TASK-172: GapHealthWidget + GapDetailList 프론트엔드 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GapHealthWidget from '../GapHealthWidget';
import type { GapCheckResult } from '../../../types';

/** 테스트용 갭 데이터 (갭이 있는 경우) */
const mockGapData: GapCheckResult = {
  gaps: [
    {
      type: 'stale-link',
      severity: 'high',
      projectId: 'proj-a',
      description: '링크가 오래되었습니다.',
      detail: { linkId: 'link-1' },
      fixable: true,
      fixCommand: 'cross-analyze --auto',
    },
    {
      type: 'unanalyzed-project',
      severity: 'medium',
      projectId: 'proj-b',
      description: '프로젝트가 미분석 상태입니다.',
      detail: {},
      fixable: true,
      fixCommand: 'cross-analyze --auto',
    },
    {
      type: 'low-confidence',
      severity: 'medium',
      projectId: 'proj-a',
      description: '분석 점수가 낮습니다.',
      detail: { totalScore: 45 },
      fixable: false,
    },
    {
      type: 'stale-index',
      severity: 'low',
      projectId: 'proj-c',
      description: '인덱스가 미갱신 상태입니다.',
      detail: {},
      fixable: true,
      fixCommand: 'reindex --project proj-c',
    },
  ],
  summary: {
    total: 4,
    high: 1,
    medium: 2,
    low: 1,
    fixable: 3,
  },
  excludedCounts: { completed: 0, onHold: 0, archived: 0 },
  checkedAt: '2026-02-23T00:00:00Z',
};

/** 누락 0건 데이터 */
const emptyGapData: GapCheckResult = {
  gaps: [],
  summary: { total: 0, high: 0, medium: 0, low: 0, fixable: 0 },
  checkedAt: '2026-02-23T00:00:00Z',
};

describe('GapHealthWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // 1. KPI 카드에 정확한 건수 표시
  // ================================================================
  it('should display correct counts in KPI cards', () => {
    render(<GapHealthWidget data={mockGapData} />);

    const highCard = screen.getByTestId('gap-kpi-high');
    expect(highCard).toHaveTextContent('1');

    const mediumCard = screen.getByTestId('gap-kpi-medium');
    expect(mediumCard).toHaveTextContent('2');

    const lowCard = screen.getByTestId('gap-kpi-low');
    expect(lowCard).toHaveTextContent('1');
  });

  it('should display summary text', () => {
    render(<GapHealthWidget data={mockGapData} />);

    const summaryText = screen.getByTestId('gap-summary-text');
    expect(summaryText).toHaveTextContent('4개 누락 발견 (3개 수정 가능)');
  });

  // ================================================================
  // 2. 누락 0건 시 축소 상태 "건강한 상태" 표시
  // ================================================================
  it('should show healthy state when no gaps', () => {
    render(<GapHealthWidget data={emptyGapData} />);

    const healthyWidget = screen.getByTestId('gap-widget-healthy');
    expect(healthyWidget).toBeInTheDocument();
    expect(healthyWidget).toHaveTextContent('건강한 상태');

    // KPI 카드는 표시되지 않아야 함
    expect(screen.queryByTestId('gap-kpi-high')).not.toBeInTheDocument();
  });

  // ================================================================
  // 3. 상세 보기 토글 동작
  // ================================================================
  it('should toggle detail list on button click', () => {
    render(<GapHealthWidget data={mockGapData} />);

    // 처음에는 상세 목록이 숨겨져 있어야 함
    expect(screen.queryByTestId('gap-detail-section')).not.toBeInTheDocument();

    // "상세 보기" 클릭
    const toggleBtn = screen.getByTestId('gap-toggle-detail');
    expect(toggleBtn).toHaveTextContent('상세 보기');
    fireEvent.click(toggleBtn);

    // 상세 목록이 표시되어야 함
    expect(screen.getByTestId('gap-detail-section')).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('접기');

    // 다시 클릭하면 숨겨야 함
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('gap-detail-section')).not.toBeInTheDocument();
  });

  it('should show gap detail cards when expanded', () => {
    render(<GapHealthWidget data={mockGapData} />);

    // 상세 보기 열기
    fireEvent.click(screen.getByTestId('gap-toggle-detail'));

    // 갭 카드 4개가 렌더링되어야 함
    const cards = screen.getAllByTestId('gap-detail-card');
    expect(cards).toHaveLength(4);
  });

  // ================================================================
  // 4. CTA 버튼 클릭 시 클립보드 복사
  // ================================================================
  it('should copy fix command to clipboard on CTA click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<GapHealthWidget data={mockGapData} />);

    // 상세 보기 열기
    fireEvent.click(screen.getByTestId('gap-toggle-detail'));

    // fixable=true + fixCommand가 있는 갭의 "명령어 복사" 버튼 클릭
    const copyButtons = screen.getAllByTestId('gap-copy-command-btn');
    // mockGapData에서 fixable=true && fixCommand 있는 항목: 3개 (stale-link, unanalyzed, stale-index)
    expect(copyButtons).toHaveLength(3);

    fireEvent.click(copyButtons[0]);
    expect(writeTextMock).toHaveBeenCalledWith('cross-analyze --auto');
  });

  it('should not show CTA button for non-fixable gaps', () => {
    const singleNonFixable: GapCheckResult = {
      gaps: [
        {
          type: 'low-confidence',
          severity: 'medium',
          projectId: 'proj-a',
          description: '낮은 점수',
          detail: {},
          fixable: false,
        },
      ],
      summary: { total: 1, high: 0, medium: 1, low: 0, fixable: 0 },
      checkedAt: '2026-02-23T00:00:00Z',
    };

    render(<GapHealthWidget data={singleNonFixable} />);
    fireEvent.click(screen.getByTestId('gap-toggle-detail'));

    expect(screen.queryByTestId('gap-copy-command-btn')).not.toBeInTheDocument();
  });

  // ================================================================
  // 5. 로딩 상태 스켈레톤 표시
  // ================================================================
  it('should show skeleton when loading', () => {
    render(<GapHealthWidget data={null} loading={true} />);

    expect(screen.getByTestId('gap-widget-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('gap-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-widget-healthy')).not.toBeInTheDocument();
  });

  // ================================================================
  // 6. API 에러 시 위젯 숨김
  // ================================================================
  it('should hide widget when data is null (API error)', () => {
    const { container } = render(<GapHealthWidget data={null} />);

    // 아무것도 렌더링하지 않아야 함
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('gap-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-widget-healthy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-widget-skeleton')).not.toBeInTheDocument();
  });

  // ================================================================
  // 추가: severity 배지 표시 확인
  // ================================================================
  it('should display severity badges correctly', () => {
    render(<GapHealthWidget data={mockGapData} />);

    // 상세 보기 열기
    fireEvent.click(screen.getByTestId('gap-toggle-detail'));

    const badges = screen.getAllByTestId('gap-severity-badge');
    expect(badges).toHaveLength(4);
    expect(badges[0]).toHaveTextContent('HIGH');
    expect(badges[1]).toHaveTextContent('MEDIUM');
    expect(badges[2]).toHaveTextContent('MEDIUM');
    expect(badges[3]).toHaveTextContent('LOW');
  });
});
