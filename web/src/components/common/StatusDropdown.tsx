/**
 * @module web/components/common/StatusDropdown
 * @description 상태 변경 드롭다운 (TASK-065)
 * VALID_TRANSITIONS에 따른 전환 가능 상태만 표시
 * API 호출: PATCH /api/results/:id/status
 * 성공 시 toast 알림, 실패 시 에러 toast
 * archived 전환 시 ArchiveConfirmDialog 표시
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { AnalysisStatus } from '../../types';
import {
  VALID_TRANSITIONS,
  STATUS_LABELS,
  STATUS_ACTION_LABELS,
  STATUS_BADGE_STYLES,
} from '../../utils/status';
import { useToastStore } from '../../stores/toastStore';
import ArchiveConfirmDialog from './ArchiveConfirmDialog';

interface StatusDropdownProps {
  /** 현재 상태 */
  currentStatus: AnalysisStatus;
  /** 분석 결과 ID */
  analysisId: string;
  /** 분석 기획서 제목 */
  analysisTitle: string;
  /** 상태 변경 콜백 */
  onStatusChange: (newStatus: AnalysisStatus) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

function StatusDropdown({
  currentStatus,
  analysisId,
  analysisTitle,
  onStatusChange,
  disabled = false,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addToast = useToastStore((s) => s.addToast);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const availableTransitions = VALID_TRANSITIONS[currentStatus];

  /** 상태 변경 API 호출 */
  const executeStatusChange = useCallback(async (newStatus: AnalysisStatus) => {
    setIsUpdating(true);
    setIsOpen(false);
    try {
      const response = await fetch(`/api/results/${analysisId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '상태 변경에 실패했습니다.');
      }

      addToast({
        type: 'success',
        message: `상태가 변경되었습니다. "${analysisTitle}": ${STATUS_LABELS[currentStatus]} → ${STATUS_LABELS[newStatus]}`,
      });
      onStatusChange(newStatus);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.',
        duration: 5000,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [analysisId, analysisTitle, currentStatus, onStatusChange, addToast]);

  /** 상태 변경 핸들러 (archived면 확인 다이얼로그 표시) */
  const handleStatusSelect = useCallback((newStatus: AnalysisStatus) => {
    if (newStatus === 'archived') {
      setIsOpen(false);
      setShowArchiveDialog(true);
    } else {
      executeStatusChange(newStatus);
    }
  }, [executeStatusChange]);

  /** 폐기 확인 다이얼로그 확인 */
  const handleArchiveConfirm = useCallback(() => {
    setShowArchiveDialog(false);
    executeStatusChange('archived');
  }, [executeStatusChange]);

  // archived 상태: 정적 배지만 표시
  if (currentStatus === 'archived') {
    return (
      <span
        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-400 rounded cursor-not-allowed"
        aria-label="폐기됨 - 상태 변경 불가"
        data-testid="status-dropdown-archived"
      >
        {STATUS_LABELS.archived}
      </span>
    );
  }

  const currentStyles = STATUS_BADGE_STYLES[currentStatus];

  return (
    <>
      <div className="relative inline-block" ref={dropdownRef}>
        {/* 트리거 버튼 */}
        <button
          onClick={() => !disabled && !isUpdating && setIsOpen(!isOpen)}
          disabled={disabled || isUpdating}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors
            ${currentStyles.bg} ${currentStyles.text} ${currentStyles.border}
            ${disabled || isUpdating ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80 cursor-pointer'}
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`현재 상태: ${STATUS_LABELS[currentStatus]}. 변경하려면 클릭`}
          data-testid="status-dropdown-trigger"
        >
          {isUpdating ? (
            <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            STATUS_LABELS[currentStatus]
          )}
          {!isUpdating && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
            </svg>
          )}
        </button>

        {/* 드롭다운 메뉴 */}
        {isOpen && availableTransitions.length > 0 && (
          <div
            className="absolute z-50 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
            role="listbox"
            aria-label="상태 변경 옵션"
            data-testid="status-dropdown-menu"
          >
            {/* 현재 상태 표시 */}
            <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100">
              현재: {STATUS_LABELS[currentStatus]}
            </div>

            {availableTransitions.map((targetStatus) => {
              const isArchive = targetStatus === 'archived';
              return (
                <button
                  key={targetStatus}
                  onClick={() => handleStatusSelect(targetStatus)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    isArchive
                      ? 'text-red-600 hover:bg-red-50 border-t border-gray-100 mt-1'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={false}
                  data-testid={`status-option-${targetStatus}`}
                >
                  <span className="font-medium">{STATUS_ACTION_LABELS[targetStatus]}</span>
                  {isArchive && (
                    <span className="block text-xs text-red-400 mt-0.5">
                      되돌릴 수 없음
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 폐기 확인 다이얼로그 */}
      <ArchiveConfirmDialog
        isOpen={showArchiveDialog}
        analysisTitle={analysisTitle}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setShowArchiveDialog(false)}
      />
    </>
  );
}

export default StatusDropdown;
