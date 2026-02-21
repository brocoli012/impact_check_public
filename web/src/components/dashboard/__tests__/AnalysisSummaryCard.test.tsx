/**
 * @module web/components/dashboard/__tests__/AnalysisSummaryCard.test
 * @description AnalysisSummaryCard 컴포넌트 단위 테스트
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AnalysisSummaryCard from '../AnalysisSummaryCard';
import type { AnalysisSummary } from '../../../types';

/* ------------------------------------------------------------------ */
/*  테스트 헬퍼                                                        */
/* ------------------------------------------------------------------ */

function getFullSummary(): AnalysisSummary {
  return {
    overview: '이번 기획은 로그인 시스템 전면 개편으로, 총 5개 화면에 영향을 미칩니다.',
    keyFindings: [
      '기존 세션 기반 인증에서 JWT 토큰 방식으로 전환 필요',
      'SSO 연동 시 기존 회원 매핑 로직 추가 필요',
      '비밀번호 정책 변경으로 기존 사용자 마이그레이션 고려 필요',
    ],
    riskAreas: [
      '인증 토큰 만료 처리 미흡 시 사용자 경험 저하',
      '기존 API 호환성 유지 필요 (하위 호환)',
    ],
  };
}

function getNoRiskSummary(): AnalysisSummary {
  return {
    overview: '단순 UI 개선 작업으로, 위험 요소가 없습니다.',
    keyFindings: ['버튼 색상 변경', '폰트 크기 조정'],
    riskAreas: [],
  };
}

function getNoFindingsSummary(): AnalysisSummary {
  return {
    overview: '소규모 설정 변경 작업입니다.',
    keyFindings: [],
    riskAreas: ['설정 파일 변경 시 서비스 재시작 필요'],
  };
}

function getMinimalSummary(): AnalysisSummary {
  return {
    overview: '영향 없음.',
    keyFindings: [],
    riskAreas: [],
  };
}

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('AnalysisSummaryCard', () => {
  /* ---------- overview 표시 ---------- */
  describe('overview 표시', () => {
    it('overview 텍스트가 표시된다', () => {
      const summary = getFullSummary();
      render(<AnalysisSummaryCard summary={summary} />);

      const overview = screen.getByTestId('summary-overview');
      expect(overview).toHaveTextContent(summary.overview);
    });

    it('overview 영역에 bg-purple-50 스타일이 적용된다', () => {
      render(<AnalysisSummaryCard summary={getFullSummary()} />);

      const overview = screen.getByTestId('summary-overview');
      expect(overview.className).toContain('bg-purple-50');
      expect(overview.className).toContain('border-purple-500');
      expect(overview.className).toContain('border-l-4');
    });
  });

  /* ---------- keyFindings 표시 ---------- */
  describe('keyFindings 목록 표시', () => {
    it('keyFindings 목록이 올바르게 표시된다 (3개)', () => {
      const summary = getFullSummary();
      render(<AnalysisSummaryCard summary={summary} />);

      const section = screen.getByTestId('summary-key-findings');
      expect(section).toBeInTheDocument();
      expect(section).toHaveTextContent('핵심 발견사항');

      for (let i = 0; i < summary.keyFindings.length; i++) {
        const item = screen.getByTestId(`key-finding-${i}`);
        expect(item).toHaveTextContent(summary.keyFindings[i]);
      }
    });

    it('keyFindings 항목에 보라색 점이 표시된다', () => {
      render(<AnalysisSummaryCard summary={getFullSummary()} />);

      const item = screen.getByTestId('key-finding-0');
      const dot = item.querySelector('span[aria-hidden="true"]');
      expect(dot).not.toBeNull();
      expect(dot!.className).toContain('bg-purple-500');
    });

    it('keyFindings가 빈 배열이면 섹션이 숨겨진다', () => {
      render(<AnalysisSummaryCard summary={getNoFindingsSummary()} />);

      expect(screen.queryByTestId('summary-key-findings')).not.toBeInTheDocument();
    });
  });

  /* ---------- riskAreas 표시 ---------- */
  describe('riskAreas 목록 표시', () => {
    it('riskAreas 목록이 올바르게 표시된다 (2개)', () => {
      const summary = getFullSummary();
      render(<AnalysisSummaryCard summary={summary} />);

      const section = screen.getByTestId('summary-risk-areas');
      expect(section).toBeInTheDocument();
      expect(section).toHaveTextContent('위험 영역');

      for (let i = 0; i < summary.riskAreas.length; i++) {
        const item = screen.getByTestId(`risk-area-${i}`);
        expect(item).toHaveTextContent(summary.riskAreas[i]);
      }
    });

    it('riskAreas 항목에 빨간색 점이 표시된다', () => {
      render(<AnalysisSummaryCard summary={getFullSummary()} />);

      const item = screen.getByTestId('risk-area-0');
      const dot = item.querySelector('span[aria-hidden="true"]');
      expect(dot).not.toBeNull();
      expect(dot!.className).toContain('bg-red-500');
    });

    it('riskAreas 영역에 bg-red-50 배경이 적용된다', () => {
      render(<AnalysisSummaryCard summary={getFullSummary()} />);

      const section = screen.getByTestId('summary-risk-areas');
      const redBg = section.querySelector('.bg-red-50');
      expect(redBg).not.toBeNull();
    });

    it('riskAreas가 빈 배열이면 섹션이 숨겨진다', () => {
      render(<AnalysisSummaryCard summary={getNoRiskSummary()} />);

      expect(screen.queryByTestId('summary-risk-areas')).not.toBeInTheDocument();
    });
  });

  /* ---------- 빈 상태 처리 ---------- */
  describe('빈 상태 처리', () => {
    it('summary가 null이면 컴포넌트를 렌더링하지 않는다', () => {
      const { container } = render(
        <AnalysisSummaryCard summary={null as unknown as AnalysisSummary} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('summary가 undefined이면 컴포넌트를 렌더링하지 않는다', () => {
      const { container } = render(
        <AnalysisSummaryCard summary={undefined as unknown as AnalysisSummary} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('keyFindings와 riskAreas 모두 비어있으면 overview만 표시된다', () => {
      render(<AnalysisSummaryCard summary={getMinimalSummary()} />);

      expect(screen.getByTestId('summary-overview')).toBeInTheDocument();
      expect(screen.queryByTestId('summary-key-findings')).not.toBeInTheDocument();
      expect(screen.queryByTestId('summary-risk-areas')).not.toBeInTheDocument();
    });
  });

  /* ---------- 카드 스타일 ---------- */
  describe('카드 스타일', () => {
    it('카드에 올바른 기본 스타일이 적용된다', () => {
      render(<AnalysisSummaryCard summary={getFullSummary()} />);

      const card = screen.getByTestId('analysis-summary-card');
      expect(card.className).toContain('bg-white');
      expect(card.className).toContain('rounded-lg');
      expect(card.className).toContain('border-gray-200');
      expect(card.className).toContain('p-5');
    });
  });
});
