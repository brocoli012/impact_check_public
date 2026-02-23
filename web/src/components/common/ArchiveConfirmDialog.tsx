/**
 * @module web/components/common/ArchiveConfirmDialog
 * @description 폐기 확인 다이얼로그 (TASK-066)
 * archived 전환 시 확인/취소 버튼, 되돌리기 불가 안내 포함
 */

import { useEffect, useRef } from 'react';

interface ArchiveConfirmDialogProps {
  /** 다이얼로그 표시 여부 */
  isOpen: boolean;
  /** 분석 기획서 제목 */
  analysisTitle: string;
  /** 확인 (폐기 실행) */
  onConfirm: () => void;
  /** 취소 */
  onCancel: () => void;
}

function ArchiveConfirmDialog({ isOpen, analysisTitle, onConfirm, onCancel }: ArchiveConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 열릴 때 취소 버튼에 포커스
  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center"
      onClick={onCancel}
      data-testid="archive-confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-dialog-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 mt-[20vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="archive-dialog-title" className="text-base font-bold text-gray-900">
            분석 결과 폐기
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <p className="text-sm text-gray-700 mb-4">
          &quot;{analysisTitle}&quot; 분석 결과를 폐기하시겠습니까?
        </p>

        {/* 경고 */}
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-6" role="alert">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-medium">폐기된 분석은 되돌릴 수 없습니다.</p>
              <p className="mt-1 text-xs text-red-600">
                보완 분석 제안 및 gap 탐지에서 영구적으로 제외됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            data-testid="archive-cancel-btn"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
            data-testid="archive-confirm-btn"
          >
            폐기 처리
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArchiveConfirmDialog;
