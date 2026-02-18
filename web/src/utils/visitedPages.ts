/**
 * @module web/utils/visitedPages
 * @description ActionGuide 방문 페이지 추적 유틸리티
 * localStorage 기반으로 analysisId별 방문 기록을 관리합니다.
 */

/**
 * localStorage 키 생성 (analysisId별 분리)
 */
function getStorageKey(analysisId: string): string {
  return `kic-action-guide-visited-${analysisId}`;
}

/**
 * 특정 analysisId에 대한 방문 페이지 목록을 반환합니다.
 */
export function getVisitedPages(analysisId: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(analysisId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * 특정 analysisId에 대해 페이지를 방문 완료로 기록합니다.
 */
export function markPageVisited(analysisId: string, route: string): void {
  try {
    const visited = new Set(getVisitedPages(analysisId));
    visited.add(route);
    localStorage.setItem(getStorageKey(analysisId), JSON.stringify([...visited]));
  } catch {
    // localStorage 접근 실패 시 무시 (네비게이션은 정상 진행)
  }
}
