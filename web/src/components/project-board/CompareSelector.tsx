/**
 * @module web/components/project-board/CompareSelector
 * @description TASK-140: 프로젝트 비교 선택 UI (A vs B)
 * 프로젝트 비교 선택 UI 컴포넌트
 */

import { useState, useCallback } from 'react';

export interface CompareSelectorProps {
  /** 선택 가능한 프로젝트 목록 */
  projects: { id: string; name: string }[];
  /** 프로젝트 A 초기값 */
  currentA: string | null;
  /** 프로젝트 B 초기값 */
  currentB: string | null;
  /** 비교 실행 콜백 (Drawer에서 사용) */
  onCompare?: (a: string, b: string) => void;
}

/**
 * 두 프로젝트를 선택하는 비교 셀렉터
 * - Drawer 내부에서는 onCompare 콜백으로 비교 실행
 * - 독립 페이지에서는 Link 기반 내비게이션 (기존 호환)
 */
export default function CompareSelector({
  projects,
  currentA,
  currentB,
  onCompare,
}: CompareSelectorProps) {
  const [a, setA] = useState(currentA || '');
  const [b, setB] = useState(currentB || '');

  const canCompare = a && b && a !== b;

  const handleCompare = useCallback(() => {
    if (canCompare && onCompare) {
      onCompare(a, b);
    }
  }, [a, b, canCompare, onCompare]);

  return (
    <div className="space-y-3" data-testid="compare-selector">
      {/* 프로젝트 A */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          프로젝트 A
        </label>
        <select
          data-testid="compare-select-a"
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">프로젝트 선택</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* VS 구분자 */}
      <div className="text-center">
        <span className="text-xs font-bold text-gray-400">VS</span>
      </div>

      {/* 프로젝트 B */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          프로젝트 B
        </label>
        <select
          data-testid="compare-select-b"
          value={b}
          onChange={(e) => setB(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">프로젝트 선택</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 비교 버튼 */}
      <button
        data-testid="compare-execute-btn"
        onClick={handleCompare}
        disabled={!canCompare}
        className={`w-full text-sm font-medium px-4 py-2 rounded-md transition-colors ${
          canCompare
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        비교 실행
      </button>
    </div>
  );
}
