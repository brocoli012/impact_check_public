/**
 * @module web/components/dashboard/__tests__/CriticalAlertBanner.test
 * @description CriticalAlertBanner 컴포넌트 단위 테스트 (TASK-050)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CriticalAlertBanner from '../CriticalAlertBanner';
import type { PolicyWarning, Check } from '../../../types';

/* ------------------------------------------------------------------ */
/*  테스트 헬퍼                                                        */
/* ------------------------------------------------------------------ */

function makeCriticalPolicy(id: string): PolicyWarning {
  return {
    id,
    policyId: `p-${id}`,
    policyName: `정책 ${id}`,
    message: `심각 경고 ${id}`,
    severity: 'critical',
    relatedTaskIds: ['t1'],
  };
}

function makeHighCheck(id: string): Check {
  return {
    id,
    content: `확인 ${id}`,
    relatedFeatureId: 'f1',
    priority: 'high',
    status: 'pending',
  };
}

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('CriticalAlertBanner', () => {
  /* ---------- 표시 조건 ---------- */
  describe('표시 조건', () => {
    it('critical 정책만 있을 때 배너를 표시한다', () => {
      render(
        <CriticalAlertBanner
          criticalPolicies={[makeCriticalPolicy('pw1'), makeCriticalPolicy('pw2')]}
          highPriorityChecks={[]}
        />,
      );

      expect(screen.getByTestId('critical-alert-banner')).toBeInTheDocument();
      expect(screen.getByTestId('critical-alert-text')).toHaveTextContent('정책 경고 2건 (critical)');
    });

    it('high priority 기획 확인만 있을 때 배너를 표시한다', () => {
      render(
        <CriticalAlertBanner
          criticalPolicies={[]}
          highPriorityChecks={[makeHighCheck('c1'), makeHighCheck('c2'), makeHighCheck('c3')]}
        />,
      );

      expect(screen.getByTestId('critical-alert-banner')).toBeInTheDocument();
      expect(screen.getByTestId('critical-alert-text')).toHaveTextContent('기획 확인 3건 (high priority)');
    });

    it('둘 다 있을 때 구분자(·)로 연결하여 표시한다', () => {
      render(
        <CriticalAlertBanner
          criticalPolicies={[makeCriticalPolicy('pw1')]}
          highPriorityChecks={[makeHighCheck('c1'), makeHighCheck('c2')]}
        />,
      );

      expect(screen.getByTestId('critical-alert-banner')).toBeInTheDocument();
      const text = screen.getByTestId('critical-alert-text').textContent;
      expect(text).toContain('정책 경고 1건 (critical)');
      expect(text).toContain('\u00B7');
      expect(text).toContain('기획 확인 2건 (high priority)');
    });
  });

  /* ---------- 미표시 조건 ---------- */
  describe('미표시 조건', () => {
    it('둘 다 비어있으면 배너를 표시하지 않는다', () => {
      const { container } = render(
        <CriticalAlertBanner criticalPolicies={[]} highPriorityChecks={[]} />,
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('critical-alert-banner')).not.toBeInTheDocument();
    });
  });

  /* ---------- 접근성 ---------- */
  describe('접근성', () => {
    it('role="alert"이 존재한다', () => {
      render(
        <CriticalAlertBanner
          criticalPolicies={[makeCriticalPolicy('pw1')]}
          highPriorityChecks={[]}
        />,
      );

      const banner = screen.getByTestId('critical-alert-banner');
      expect(banner).toHaveAttribute('role', 'alert');
    });
  });

  /* ---------- 개수 정확 표시 ---------- */
  describe('개수 정확 표시', () => {
    it('critical 정책 1건을 정확히 표시한다', () => {
      render(
        <CriticalAlertBanner
          criticalPolicies={[makeCriticalPolicy('pw1')]}
          highPriorityChecks={[]}
        />,
      );

      expect(screen.getByTestId('critical-alert-text')).toHaveTextContent('정책 경고 1건 (critical)');
    });

    it('high priority 기획 확인 5건을 정확히 표시한다', () => {
      const checks = Array.from({ length: 5 }, (_, i) => makeHighCheck(`c${i}`));

      render(
        <CriticalAlertBanner criticalPolicies={[]} highPriorityChecks={checks} />,
      );

      expect(screen.getByTestId('critical-alert-text')).toHaveTextContent('기획 확인 5건 (high priority)');
    });
  });
});
