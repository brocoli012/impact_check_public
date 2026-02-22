/**
 * @module web/components/common/__tests__/EmptyResultGuide.test
 * @description EmptyResultGuide 공통 컴포넌트 테스트 (REQ-014, TASK-119)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyResultGuide from '../EmptyResultGuide';

describe('EmptyResultGuide', () => {
  describe('default props', () => {
    it('should render with default title', () => {
      render(<EmptyResultGuide />);

      expect(
        screen.getByText('좌측 목록에서 기획서를 선택해주세요.'),
      ).toBeInTheDocument();
    });

    it('should render with default description', () => {
      render(<EmptyResultGuide />);

      expect(
        screen.getByText('기획서를 선택하면 분석 결과를 확인할 수 있습니다.'),
      ).toBeInTheDocument();
    });

    it('should render with default document icon', () => {
      render(<EmptyResultGuide />);

      expect(screen.getByTestId('icon-document')).toBeInTheDocument();
    });

    it('should have data-testid', () => {
      render(<EmptyResultGuide />);

      expect(screen.getByTestId('empty-result-guide')).toBeInTheDocument();
    });
  });

  describe('custom props', () => {
    it('should render custom title', () => {
      render(<EmptyResultGuide title="커스텀 안내 메시지" />);

      expect(screen.getByText('커스텀 안내 메시지')).toBeInTheDocument();
      expect(
        screen.queryByText('좌측 목록에서 기획서를 선택해주세요.'),
      ).not.toBeInTheDocument();
    });

    it('should render custom description', () => {
      render(<EmptyResultGuide description="설명 텍스트입니다." />);

      expect(screen.getByText('설명 텍스트입니다.')).toBeInTheDocument();
    });

    it('should render custom title and description together', () => {
      render(
        <EmptyResultGuide
          title="분석 결과를 선택해주세요"
          description="선택하면 상세 결과를 확인할 수 있습니다."
        />,
      );

      expect(screen.getByText('분석 결과를 선택해주세요')).toBeInTheDocument();
      expect(
        screen.getByText('선택하면 상세 결과를 확인할 수 있습니다.'),
      ).toBeInTheDocument();
    });
  });

  describe('icon variants', () => {
    it('should render document icon by default', () => {
      render(<EmptyResultGuide />);

      expect(screen.getByTestId('icon-document')).toBeInTheDocument();
    });

    it('should render chart icon', () => {
      render(<EmptyResultGuide icon="chart" />);

      expect(screen.getByTestId('icon-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-document')).not.toBeInTheDocument();
    });

    it('should render checklist icon', () => {
      render(<EmptyResultGuide icon="checklist" />);

      expect(screen.getByTestId('icon-checklist')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-document')).not.toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('should have min-h-[400px] container', () => {
      render(<EmptyResultGuide />);

      const container = screen.getByTestId('empty-result-guide');
      expect(container.classList.contains('min-h-[400px]')).toBe(true);
    });

    it('should have centered content', () => {
      render(<EmptyResultGuide />);

      const container = screen.getByTestId('empty-result-guide');
      expect(container.classList.contains('flex')).toBe(true);
      expect(container.classList.contains('items-center')).toBe(true);
      expect(container.classList.contains('justify-center')).toBe(true);
    });
  });
});
