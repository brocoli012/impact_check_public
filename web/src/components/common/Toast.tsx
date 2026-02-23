/**
 * @module web/components/common/Toast
 * @description Toast 공통 컴포넌트 (TASK-095)
 * success/error/info 3가지 타입, 3초 자동 닫기, 수동 닫기 버튼
 */

import { useToastStore } from '../../stores/toastStore';
import type { ToastItem } from '../../stores/toastStore';

/** 타입별 스타일 */
const TOAST_STYLES: Record<ToastItem['type'], { container: string; icon: string }> = {
  success: {
    container: 'bg-gray-900 text-white',
    icon: 'M5 13l4 4L19 7',  // checkmark
  },
  error: {
    container: 'bg-red-600 text-white',
    icon: 'M6 18L18 6M6 6l12 12',  // X
  },
  info: {
    container: 'bg-gray-900 text-white',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',  // info circle
  },
};

/** 개별 토스트 아이템 */
function ToastItemView({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const styles = TOAST_STYLES[toast.type];

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`${styles.container} rounded-lg shadow-lg p-3 text-sm flex items-start gap-2 min-w-[280px] max-w-[400px] animate-slide-in`}
      data-testid={`toast-${toast.type}`}
    >
      {/* Icon */}
      <svg
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={styles.icon} />
      </svg>

      {/* Message */}
      <span className="flex-1">{toast.message}</span>

      {/* Close button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
        aria-label="닫기"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** 토스트 컨테이너 - App 루트에 배치 */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-label="알림 목록"
    >
      {toasts.map((toast) => (
        <ToastItemView
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

export default ToastContainer;
