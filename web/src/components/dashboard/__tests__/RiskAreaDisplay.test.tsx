/**
 * @module web/components/dashboard/__tests__/RiskAreaDisplay.test
 * @description RiskAreaDisplay 컴포넌트 단위 테스트 (REQ-018-A2 / TASK-123)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RiskAreaDisplay from '../RiskAreaDisplay';
import type { RiskArea } from '../../../types';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function createRiskArea(overrides: Partial<RiskArea> = {}): RiskArea {
  return {
    id: 'risk-001',
    description: '역방향 토픽 발행 실패 시 데이터 불일치',
    impact: 'high',
    mitigation: 'Dead Letter Queue 구성',
    relatedProjects: ['lip', 'e-scm-api'],
    category: 'data-integrity',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe('RiskAreaDisplay', () => {
  /* ---------- Empty state ---------- */
  describe('빈 상태 처리', () => {
    it('riskAreas가 빈 배열이면 렌더링하지 않는다', () => {
      const { container } = render(<RiskAreaDisplay riskAreas={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('riskAreas가 null이면 렌더링하지 않는다', () => {
      const { container } = render(
        <RiskAreaDisplay riskAreas={null as unknown as (string | RiskArea)[]} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  /* ---------- String-only risks (legacy) ---------- */
  describe('문자열 리스크 (레거시 호환)', () => {
    it('문자열 리스크를 불릿 목록으로 표시한다', () => {
      const risks = ['인증 토큰 만료 처리 미흡', '기존 API 호환성 유지 필요'];
      render(<RiskAreaDisplay riskAreas={risks} />);

      expect(screen.getByTestId('string-risks')).toBeInTheDocument();
      expect(screen.getByTestId('string-risk-0')).toHaveTextContent('인증 토큰 만료 처리 미흡');
      expect(screen.getByTestId('string-risk-1')).toHaveTextContent('기존 API 호환성 유지 필요');
    });

    it('문자열 리스크에 빨간색 점이 표시된다', () => {
      render(<RiskAreaDisplay riskAreas={['테스트 리스크']} />);

      const item = screen.getByTestId('string-risk-0');
      const dot = item.querySelector('span[aria-hidden="true"]');
      expect(dot).not.toBeNull();
      expect(dot!.className).toContain('bg-red-500');
    });

    it('문자열만 있으면 테이블이 표시되지 않는다', () => {
      render(<RiskAreaDisplay riskAreas={['리스크 1', '리스크 2']} />);

      expect(screen.queryByTestId('structured-risks')).not.toBeInTheDocument();
    });

    it('문자열만 있으면 "추가 주의사항" 헤딩이 없다', () => {
      render(<RiskAreaDisplay riskAreas={['리스크']} />);

      expect(screen.queryByText('추가 주의사항')).not.toBeInTheDocument();
    });
  });

  /* ---------- Structured risks (RiskArea objects) ---------- */
  describe('구조화된 리스크 (RiskArea 객체)', () => {
    it('구조화된 리스크를 테이블로 표시한다', () => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea()]} />);

      expect(screen.getByTestId('structured-risks')).toBeInTheDocument();
      expect(screen.getByTestId('structured-risk-0')).toBeInTheDocument();
    });

    it('리스크 설명이 테이블에 표시된다', () => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea({ description: '테스트 설명' })]} />);

      expect(screen.getByTestId('structured-risk-0')).toHaveTextContent('테스트 설명');
    });

    it('영향도 배지가 표시된다', () => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea({ impact: 'critical' })]} />);

      const badge = screen.getByTestId('impact-badge');
      expect(badge).toHaveTextContent('심각');
    });

    it('완화 방안이 표시된다', () => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea({ mitigation: '테스트 완화방안' })]} />);

      expect(screen.getByTestId('structured-risk-0')).toHaveTextContent('테스트 완화방안');
    });

    it('RiskArea만 있으면 불릿 목록이 표시되지 않는다', () => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea()]} />);

      expect(screen.queryByTestId('string-risks')).not.toBeInTheDocument();
    });

    it('카테고리 컬럼이 있는 리스크가 있으면 카테고리 헤더가 표시된다', () => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea({ category: 'technical' })]} />);

      expect(screen.getByText('카테고리')).toBeInTheDocument();
    });
  });

  /* ---------- Mixed risks ---------- */
  describe('혼합 리스크 (문자열 + RiskArea)', () => {
    it('구조화 리스크는 테이블로, 문자열 리스크는 불릿으로 분리 표시한다', () => {
      const mixed: (string | RiskArea)[] = [
        createRiskArea({ id: 'risk-001' }),
        '문자열 리스크',
      ];

      render(<RiskAreaDisplay riskAreas={mixed} />);

      expect(screen.getByTestId('structured-risks')).toBeInTheDocument();
      expect(screen.getByTestId('string-risks')).toBeInTheDocument();
      expect(screen.getByTestId('structured-risk-0')).toBeInTheDocument();
      expect(screen.getByTestId('string-risk-0')).toHaveTextContent('문자열 리스크');
    });

    it('혼합 시 "추가 주의사항" 헤딩이 표시된다', () => {
      const mixed: (string | RiskArea)[] = [
        createRiskArea(),
        '문자열 리스크',
      ];

      render(<RiskAreaDisplay riskAreas={mixed} />);

      expect(screen.getByText('추가 주의사항')).toBeInTheDocument();
    });
  });

  /* ---------- Impact badge variants ---------- */
  describe('영향도 배지', () => {
    it.each([
      ['low', '낮음'],
      ['medium', '보통'],
      ['high', '높음'],
      ['critical', '심각'],
    ] as [RiskArea['impact'], string][])('impact "%s"일 때 "%s" 라벨이 표시된다', (impact, label) => {
      render(<RiskAreaDisplay riskAreas={[createRiskArea({ impact })]} />);

      const badge = screen.getByTestId('impact-badge');
      expect(badge).toHaveTextContent(label);
    });
  });
});
