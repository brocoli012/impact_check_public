/**
 * @module web/components/dashboard/__tests__/ScoreHeader.test
 * @description ScoreHeader 컴포넌트 단위 테스트 (TASK-049: Flow Strip)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ScoreHeader from '../ScoreHeader';
import type { ImpactFlowData } from '../ScoreHeader';

/* ------------------------------------------------------------------ */
/*  테스트 헬퍼                                                        */
/* ------------------------------------------------------------------ */

const baseProps = {
  totalScore: 65,
  grade: 'High' as const,
  specTitle: '테스트 기획서',
  analyzedAt: '2025-01-15T10:30:00Z',
  recommendation: '별도 프로젝트 계획이 필요합니다.',
};

const fullImpactFlow: ImpactFlowData = {
  actionCounts: { new: 3, modify: 5, config: 2 },
  affectedScreenCount: 4,
  totalTaskCount: 10,
};

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('ScoreHeader', () => {
  /* ---------- 기본 렌더링 ---------- */
  describe('기본 렌더링', () => {
    it('기획서 제목을 표시한다', () => {
      render(<ScoreHeader {...baseProps} />);
      expect(screen.getByText('테스트 기획서')).toBeInTheDocument();
    });

    it('종합 점수를 표시한다', () => {
      render(<ScoreHeader {...baseProps} />);
      expect(screen.getByText('65')).toBeInTheDocument();
    });

    it('추천 사항을 표시한다', () => {
      render(<ScoreHeader {...baseProps} />);
      expect(screen.getByText('별도 프로젝트 계획이 필요합니다.')).toBeInTheDocument();
    });
  });

  /* ---------- Flow Strip ---------- */
  describe('Flow Strip', () => {
    it('impactFlow가 있을 때 Flow Strip을 표시한다', () => {
      render(<ScoreHeader {...baseProps} impactFlow={fullImpactFlow} />);
      expect(screen.getByTestId('flow-strip')).toBeInTheDocument();
    });

    it('impactFlow가 없을 때 Flow Strip을 표시하지 않는다', () => {
      render(<ScoreHeader {...baseProps} />);
      expect(screen.queryByTestId('flow-strip')).not.toBeInTheDocument();
    });

    it('impactFlow가 undefined일 때 Flow Strip을 표시하지 않는다', () => {
      render(<ScoreHeader {...baseProps} impactFlow={undefined} />);
      expect(screen.queryByTestId('flow-strip')).not.toBeInTheDocument();
    });

    it('모든 actionType 칩을 표시한다 (값이 0이 아닌 경우)', () => {
      render(<ScoreHeader {...baseProps} impactFlow={fullImpactFlow} />);

      expect(screen.getByTestId('flow-chip-new')).toBeInTheDocument();
      expect(screen.getByTestId('flow-chip-modify')).toBeInTheDocument();
      expect(screen.getByTestId('flow-chip-config')).toBeInTheDocument();
    });

    it('actionType 칩에 올바른 값을 표시한다', () => {
      render(<ScoreHeader {...baseProps} impactFlow={fullImpactFlow} />);

      expect(screen.getByTestId('flow-chip-new')).toHaveTextContent('신규 3');
      expect(screen.getByTestId('flow-chip-modify')).toHaveTextContent('수정 5');
      expect(screen.getByTestId('flow-chip-config')).toHaveTextContent('설정 2');
    });

    it('값이 0인 actionType 칩은 숨긴다', () => {
      const flowWithZero: ImpactFlowData = {
        actionCounts: { new: 2, modify: 0, config: 1 },
        affectedScreenCount: 3,
        totalTaskCount: 3,
      };

      render(<ScoreHeader {...baseProps} impactFlow={flowWithZero} />);

      expect(screen.getByTestId('flow-chip-new')).toBeInTheDocument();
      expect(screen.queryByTestId('flow-chip-modify')).not.toBeInTheDocument();
      expect(screen.getByTestId('flow-chip-config')).toBeInTheDocument();
    });

    it('모든 actionType이 0이면 칩을 하나도 표시하지 않는다', () => {
      const flowAllZero: ImpactFlowData = {
        actionCounts: { new: 0, modify: 0, config: 0 },
        affectedScreenCount: 2,
        totalTaskCount: 5,
      };

      render(<ScoreHeader {...baseProps} impactFlow={flowAllZero} />);

      expect(screen.queryByTestId('flow-chip-new')).not.toBeInTheDocument();
      expect(screen.queryByTestId('flow-chip-modify')).not.toBeInTheDocument();
      expect(screen.queryByTestId('flow-chip-config')).not.toBeInTheDocument();
    });

    it('영향 화면 수를 표시한다', () => {
      render(<ScoreHeader {...baseProps} impactFlow={fullImpactFlow} />);

      expect(screen.getByTestId('flow-screen-count')).toHaveTextContent('영향 화면 4개');
    });

    it('총 작업 수를 표시한다', () => {
      render(<ScoreHeader {...baseProps} impactFlow={fullImpactFlow} />);

      expect(screen.getByTestId('flow-task-count')).toHaveTextContent('총 작업 10개');
    });
  });
});
