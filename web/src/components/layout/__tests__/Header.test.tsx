/**
 * @module web/components/layout/__tests__/Header.test
 * @description TASK-120/124: Header GNB 변경 테스트
 *
 * 검증 항목:
 * - NAV_TABS 변경 반영 ('프로젝트 보드', '기획 분석' 등)
 * - 프로젝트 드롭다운 제거 확인
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import Header from '../Header';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('Header (TASK-120)', () => {
  describe('NAV_TABS', () => {
    it('should render "프로젝트 보드" tab', () => {
      renderWithRouter(<Header />);
      expect(screen.getByText('프로젝트 보드')).toBeInTheDocument();
    });

    it('should render "기획 분석" tab', () => {
      renderWithRouter(<Header />);
      expect(screen.getByText('기획 분석')).toBeInTheDocument();
    });

    it('should render all expected navigation tabs', () => {
      renderWithRouter(<Header />);
      const expectedTabs = ['프로젝트 보드', '기획 분석', '플로우차트', '체크리스트', '담당자', '티켓', '정책'];
      for (const label of expectedTabs) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it('should NOT render old "대시보드" tab', () => {
      renderWithRouter(<Header />);
      expect(screen.queryByText('대시보드')).not.toBeInTheDocument();
    });

    it('should NOT render old "프로젝트" tab', () => {
      renderWithRouter(<Header />);
      // "프로젝트 보드" exists but standalone "프로젝트" should not
      const links = screen.getAllByRole('link');
      const projectOnlyLink = links.find(
        (link) => link.textContent === '프로젝트',
      );
      expect(projectOnlyLink).toBeUndefined();
    });
  });

  describe('프로젝트 드롭다운 제거', () => {
    it('should NOT render project selector dropdown', () => {
      renderWithRouter(<Header />);
      expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
    });

    it('should NOT render any select element', () => {
      renderWithRouter(<Header />);
      const selects = screen.queryAllByRole('combobox');
      expect(selects).toHaveLength(0);
    });
  });

  describe('기본 구조', () => {
    it('should render app title', () => {
      renderWithRouter(<Header />);
      expect(screen.getByText('Kurly Impact Checker')).toBeInTheDocument();
    });

    it('should render nav with aria-label', () => {
      renderWithRouter(<Header />);
      expect(screen.getByLabelText('메인 네비게이션')).toBeInTheDocument();
    });
  });
});
