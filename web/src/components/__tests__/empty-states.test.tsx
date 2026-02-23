/**
 * @module web/components/__tests__/empty-states.test
 * @description TASK-180: 빈 데이터 상태에서의 UI 컴포넌트 렌더링 검증
 *
 * 테스트 대상:
 * 1. GapHealthWidget - 빈 gaps 시 건강한 상태 표시
 * 2. GapDetailList - gaps=[] 시 빈 목록 표시
 * 3. CrossProjectTabs - 빈 배열 props 시 각 탭 빈 상태
 * 4. CrossProjectDiagram - links=[] 시 empty 상태
 * 5. SupplementBanner - 정상 렌더링 + 클릭 핸들러
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import GapHealthWidget from '../projects/GapHealthWidget';
import GapDetailList from '../projects/GapDetailList';
import CrossProjectDiagram from '../cross-project/CrossProjectDiagram';
import SupplementBanner from '../dashboard/SupplementBanner';
import type { GapCheckResult } from '../../types';

// ============================================================
// CrossProjectTabs 의존성 mock
// ============================================================

// CrossProjectTabs는 useNavigate, useSharedEntityStore 등 외부 의존성이 많으므로
// 하위 컴포넌트들(CrossProjectDiagram, SharedEntityMap)을 직접 테스트하고
// CrossProjectTabs는 라우터 래퍼로 렌더링합니다.

// react-router-dom의 useNavigate mock
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// sharedEntityStore mock: 빈 데이터 + fetchSharedEntities no-op
vi.mock('../../stores/sharedEntityStore', () => ({
  useSharedEntityStore: () => ({
    tables: [],
    events: [],
    stats: null,
    searchResult: null,
    isLoading: false,
    error: null,
    fetchSharedEntities: vi.fn(),
    searchReverse: vi.fn(),
    clearSearch: vi.fn(),
  }),
}));

/** BrowserRouter 래퍼 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/** 빈 갭 데이터 */
const emptyGapData: GapCheckResult = {
  gaps: [],
  summary: { total: 0, high: 0, medium: 0, low: 0, fixable: 0 },
  checkedAt: '2026-02-23T00:00:00Z',
};

// ============================================================
// 1. GapHealthWidget: 빈 gaps -> 건강한 상태 렌더링
// ============================================================
describe('GapHealthWidget - empty state', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render healthy state when gaps total is 0', () => {
    render(<GapHealthWidget data={emptyGapData} />);

    const healthyWidget = screen.getByTestId('gap-widget-healthy');
    expect(healthyWidget).toBeInTheDocument();
    expect(healthyWidget).toHaveTextContent('건강한 상태');
  });

  it('should have role="status" on healthy widget', () => {
    render(<GapHealthWidget data={emptyGapData} />);

    const healthyWidget = screen.getByTestId('gap-widget-healthy');
    expect(healthyWidget).toHaveAttribute('role', 'status');
  });

  it('should not display KPI cards when no gaps', () => {
    render(<GapHealthWidget data={emptyGapData} />);

    expect(screen.queryByTestId('gap-kpi-high')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-kpi-medium')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-kpi-low')).not.toBeInTheDocument();
  });

  it('should not display toggle button when no gaps', () => {
    render(<GapHealthWidget data={emptyGapData} />);

    expect(screen.queryByTestId('gap-toggle-detail')).not.toBeInTheDocument();
  });

  it('should render nothing when data is null (API error)', () => {
    const { container } = render(<GapHealthWidget data={null} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('gap-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-widget-healthy')).not.toBeInTheDocument();
  });
});

// ============================================================
// 2. GapDetailList: gaps=[] -> 빈 목록 표시
// ============================================================
describe('GapDetailList - empty state', () => {
  it('should show empty message when gaps array is empty', () => {
    render(<GapDetailList gaps={[]} />);

    const emptyEl = screen.getByTestId('gap-detail-empty');
    expect(emptyEl).toBeInTheDocument();
    expect(emptyEl).toHaveTextContent('표시할 갭 항목이 없습니다.');
  });

  it('should not render gap detail cards when empty', () => {
    render(<GapDetailList gaps={[]} />);

    expect(screen.queryByTestId('gap-detail-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-detail-list')).not.toBeInTheDocument();
  });
});

// ============================================================
// 3. CrossProjectTabs: 빈 배열 props -> 각 탭에 빈 상태 메시지
// ============================================================
describe('CrossProjectTabs - empty state', () => {
  // CrossProjectTabs는 내부적으로 useNavigate와 useSharedEntityStore를 사용하므로
  // 라우터 래퍼 + store mock과 함께 렌더링합니다.
  // 대신 각 하위 컴포넌트의 빈 상태를 개별 검증합니다.

  let CrossProjectTabs: typeof import('../cross-project/CrossProjectTabs').default;

  beforeEach(async () => {
    // 동적 import로 mock이 적용된 후 로드
    const mod = await import('../cross-project/CrossProjectTabs');
    CrossProjectTabs = mod.default;
  });

  it('should render tabs component with empty links', () => {
    renderWithRouter(<CrossProjectTabs links={[]} groups={[]} />);

    const tabsEl = screen.getByTestId('cross-project-tabs');
    expect(tabsEl).toBeInTheDocument();
  });

  it('should show empty diagram in dependencies tab (default)', () => {
    renderWithRouter(<CrossProjectTabs links={[]} groups={[]} />);

    // 의존성 탭이 기본 활성 상태이므로 빈 다이어그램이 표시되어야 함
    expect(screen.getByTestId('cross-project-diagram-empty')).toBeInTheDocument();
  });

  it('should show empty shared entities when clicking shared-entities tab', () => {
    renderWithRouter(<CrossProjectTabs links={[]} groups={[]} />);

    // 공유 엔티티 탭 클릭
    const sharedEntitiesTab = screen.getByTestId('tab-shared-entities');
    fireEvent.click(sharedEntitiesTab);

    // store mock이 빈 tables/events를 반환하므로 빈 상태가 표시되어야 함
    expect(screen.getByTestId('shared-entity-map-empty')).toBeInTheDocument();
  });

  it('should show empty pub/sub when clicking pub-sub tab', () => {
    renderWithRouter(<CrossProjectTabs links={[]} groups={[]} />);

    // Pub/Sub 탭 클릭
    const pubSubTab = screen.getByTestId('tab-pub-sub');
    fireEvent.click(pubSubTab);

    // store mock이 빈 events를 반환하므로 빈 상태가 표시되어야 함
    expect(screen.getByTestId('shared-entity-map-empty')).toBeInTheDocument();
  });

  it('should render all 4 tab buttons', () => {
    renderWithRouter(<CrossProjectTabs links={[]} groups={[]} />);

    expect(screen.getByTestId('tab-dependencies')).toBeInTheDocument();
    expect(screen.getByTestId('tab-shared-entities')).toBeInTheDocument();
    expect(screen.getByTestId('tab-pub-sub')).toBeInTheDocument();
    expect(screen.getByTestId('tab-summary')).toBeInTheDocument();
  });
});

// ============================================================
// 4. CrossProjectDiagram: links=[] -> empty 상태
// ============================================================
describe('CrossProjectDiagram - empty state', () => {
  it('should render empty state when links is empty', () => {
    render(<CrossProjectDiagram links={[]} />);

    const emptyEl = screen.getByTestId('cross-project-diagram-empty');
    expect(emptyEl).toBeInTheDocument();
    expect(emptyEl).toHaveTextContent('등록된 프로젝트 의존성이 없습니다');
  });

  it('should not render diagram container when links is empty', () => {
    render(<CrossProjectDiagram links={[]} />);

    expect(screen.queryByTestId('cross-project-diagram')).not.toBeInTheDocument();
  });

  it('should not call onNodeClick when empty', () => {
    const mockClick = vi.fn();
    render(<CrossProjectDiagram links={[]} onNodeClick={mockClick} />);

    // 빈 상태에서는 노드가 없으므로 클릭 핸들러가 호출되지 않아야 함
    expect(mockClick).not.toHaveBeenCalled();
  });
});

// ============================================================
// 5. SupplementBanner: 정상 렌더링 + 클릭 핸들러 호출
// ============================================================
describe('SupplementBanner', () => {
  it('should render banner with supplement info', () => {
    render(
      <SupplementBanner
        supplementOf="analysis-001"
        triggerProject="프로젝트-Alpha"
      />
    );

    const banner = screen.getByTestId('supplement-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('프로젝트-Alpha');
    expect(banner).toHaveTextContent('보완 분석');
  });

  it('should have role="status" for accessibility', () => {
    render(
      <SupplementBanner
        supplementOf="analysis-001"
        triggerProject="프로젝트-Alpha"
      />
    );

    const banner = screen.getByTestId('supplement-banner');
    expect(banner).toHaveAttribute('role', 'status');
  });

  it('should display original analysis ID', () => {
    render(
      <SupplementBanner
        supplementOf="analysis-001"
        triggerProject="프로젝트-Alpha"
      />
    );

    const banner = screen.getByTestId('supplement-banner');
    expect(banner).toHaveTextContent('analysis-001');
  });

  it('should render clickable link when onOriginalClick is provided', () => {
    const mockClick = vi.fn();
    render(
      <SupplementBanner
        supplementOf="analysis-001"
        triggerProject="프로젝트-Alpha"
        onOriginalClick={mockClick}
      />
    );

    const link = screen.getByTestId('supplement-original-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('analysis-001');
  });

  it('should call onOriginalClick with analysis ID when link is clicked', () => {
    const mockClick = vi.fn();
    render(
      <SupplementBanner
        supplementOf="analysis-001"
        triggerProject="프로젝트-Alpha"
        onOriginalClick={mockClick}
      />
    );

    const link = screen.getByTestId('supplement-original-link');
    fireEvent.click(link);

    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(mockClick).toHaveBeenCalledWith('analysis-001');
  });

  it('should not render clickable link when onOriginalClick is not provided', () => {
    render(
      <SupplementBanner
        supplementOf="analysis-001"
        triggerProject="프로젝트-Alpha"
      />
    );

    expect(screen.queryByTestId('supplement-original-link')).not.toBeInTheDocument();
    // 원본 분석 ID는 span으로 표시되어야 함
    const banner = screen.getByTestId('supplement-banner');
    expect(banner).toHaveTextContent('analysis-001');
  });
});
