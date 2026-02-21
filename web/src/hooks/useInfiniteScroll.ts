/**
 * @module web/hooks/useInfiniteScroll
 * @description IntersectionObserver 기반 무한 스크롤 훅
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** 추가 로드 가능 여부 */
  hasMore: boolean;
  /** 로딩 상태 */
  loading: boolean;
  /** 추가 데이터 로드 콜백 */
  onLoadMore: () => void;
  /** IntersectionObserver threshold (기본값: 0.1) */
  threshold?: number;
  /** 루트 마진 (기본값: '200px') */
  rootMargin?: string;
}

/**
 * IntersectionObserver 기반 무한 스크롤 훅
 *
 * 반환된 sentinelRef를 리스트 하단 sentinel 엘리먼트에 부착하면,
 * 해당 엘리먼트가 뷰포트에 들어올 때 onLoadMore가 호출됩니다.
 *
 * @example
 * ```tsx
 * const { sentinelRef } = useInfiniteScroll({
 *   hasMore,
 *   loading,
 *   onLoadMore: () => fetchMore(),
 * });
 *
 * return (
 *   <div>
 *     {items.map(item => <Card key={item.id} />)}
 *     <div ref={sentinelRef} />
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  threshold = 0.1,
  rootMargin = '200px',
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore],
  );

  useEffect(() => {
    // 기존 observer 해제
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // 새 observer 생성
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    });

    // sentinel 관찰 시작
    const sentinel = sentinelRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersection, threshold, rootMargin]);

  return { sentinelRef };
}
