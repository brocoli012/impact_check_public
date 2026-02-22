/**
 * @module web/components/project-board/CompareDrawer
 * @description TASK-141: 프로젝트 비교 Drawer
 * 우측에서 슬라이드 인되는 비교 패널
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import CompareSelector from './CompareSelector';
import CompareTable from './CompareTable';

export interface CompareDrawerProps {
  /** Drawer 열림 상태 */
  isOpen: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 현재 선택된 프로젝트 ID (프로젝트 A 기본값) */
  currentProjectId: string | null;
}

/**
 * 프로젝트 비교 Drawer
 * - 우측에서 슬라이드 인 (width: 400px, lg: 360px)
 * - 배경 오버레이: bg-black/30
 * - 닫기: X 버튼 + ESC 키 + 배경 클릭
 * - 접근성: role="dialog", aria-labelledby, focus trap
 */
export default function CompareDrawer({
  isOpen,
  onClose,
  currentProjectId,
}: CompareDrawerProps) {
  const { projects } = useProjectStore();
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = 'compare-drawer-title';

  // 비교 대상 프로젝트 ID 상태
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);

  // Drawer가 열릴 때 기본값 설정
  useEffect(() => {
    if (isOpen) {
      setSelectedA(currentProjectId);
      setSelectedB(null);
    }
  }, [isOpen, currentProjectId]);

  // ESC 키 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Drawer 열릴 때 포커스 이동
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isOpen]);

  // body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 배경 클릭 핸들러
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // 비교 실행 콜백
  const handleCompare = useCallback((a: string, b: string) => {
    setSelectedA(a);
    setSelectedB(b);
  }, []);

  // 프로젝트 선택 옵션
  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );

  // 프로젝트 A/B 객체
  const projectA = useMemo(
    () => projects.find((p) => p.id === selectedA) || null,
    [projects, selectedA],
  );
  const projectB = useMemo(
    () => projects.find((p) => p.id === selectedB) || null,
    [projects, selectedB],
  );

  return (
    <>
      {/* 오버레이 + 슬라이드 패널 */}
      <div
        data-testid="compare-drawer-overlay"
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        onClick={handleBackdropClick}
        aria-hidden={!isOpen}
      >
        {/* Drawer 패널 */}
        <div
          ref={drawerRef}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal="true"
          tabIndex={-1}
          data-testid="compare-drawer"
          className={`absolute top-0 right-0 h-full w-[400px] lg:w-[360px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2
              id={titleId}
              className="text-base font-bold text-gray-900"
            >
              프로젝트 비교
            </h2>
            <button
              data-testid="compare-drawer-close"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="닫기"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 본문 - 스크롤 가능 */}
          <div className="overflow-y-auto h-[calc(100%-57px)] px-5 py-4 space-y-5">
            {/* 비교 선택기 */}
            <CompareSelector
              projects={projectOptions}
              currentA={currentProjectId}
              currentB={null}
              onCompare={handleCompare}
            />

            {/* 비교 결과 테이블 */}
            <CompareTable projectA={projectA} projectB={projectB} />
          </div>
        </div>
      </div>
    </>
  );
}
