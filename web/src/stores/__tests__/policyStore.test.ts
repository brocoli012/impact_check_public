/**
 * @module web/stores/__tests__/policyStore.test
 * @description policyStore Zustand 스토어 테스트 - initialLoaded 동작 검증 (BUG-005)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePolicyStore } from '../policyStore';
import { useProjectStore } from '../projectStore';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

/** API 응답을 만드는 헬퍼 */
function mockFetchResponse(data: Record<string, unknown>) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

describe('policyStore', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    usePolicyStore.getState().reset();
    // projectStore에 activeProjectId 설정
    useProjectStore.setState({ activeProjectId: 'proj-1' });
  });

  describe('initialLoaded', () => {
    it('should start with initialLoaded: false', () => {
      expect(usePolicyStore.getState().initialLoaded).toBe(false);
    });

    it('should set initialLoaded: true after first successful fetchPolicies', async () => {
      mockFetchResponse({
        policies: [{ id: 'p1', name: 'Policy 1', category: 'test', description: 'desc', confidence: 0.8 }],
        categories: ['test'],
        total: 100,
        hasMore: true,
      });

      await usePolicyStore.getState().fetchPolicies();

      const state = usePolicyStore.getState();
      expect(state.initialLoaded).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.policies).toHaveLength(1);
    });

    it('should set loading: true on first fetch (initialLoaded: false)', async () => {
      // 느린 fetch를 시뮬레이션하기 위해 직접 상태 추적
      let capturedLoadingDuringFetch = false;

      // fetchPolicies 호출 전 loading 확인을 위해 fetch를 지연
      vi.mocked(fetch).mockImplementationOnce(() => {
        // fetch가 호출된 시점에 loading 상태 캡처
        capturedLoadingDuringFetch = usePolicyStore.getState().loading;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ policies: [], categories: [], total: 0, hasMore: false }),
        } as Response);
      });

      await usePolicyStore.getState().fetchPolicies();

      expect(capturedLoadingDuringFetch).toBe(true);
    });

    it('should NOT set loading: true on subsequent fetch (initialLoaded: true)', async () => {
      // 첫 번째 로드 (initialLoaded 설정)
      mockFetchResponse({
        policies: [{ id: 'p1', name: 'Policy 1', category: 'test', description: 'desc', confidence: 0.8 }],
        categories: ['test'],
        total: 100,
        hasMore: false,
      });
      await usePolicyStore.getState().fetchPolicies();
      expect(usePolicyStore.getState().initialLoaded).toBe(true);

      // 두 번째 로드 - loading이 true로 설정되면 안 됨
      let capturedLoadingDuringRefetch = false;
      vi.mocked(fetch).mockImplementationOnce(() => {
        capturedLoadingDuringRefetch = usePolicyStore.getState().loading;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            policies: [{ id: 'p2', name: 'Policy 2', category: 'test', description: 'desc2', confidence: 0.9 }],
            categories: ['test'],
            total: 200,
            hasMore: false,
          }),
        } as Response);
      });

      await usePolicyStore.getState().fetchPolicies();

      expect(capturedLoadingDuringRefetch).toBe(false);
      expect(usePolicyStore.getState().loading).toBe(false);
    });

    it('should reset initialLoaded to false on reset()', async () => {
      // 첫 번째 로드
      mockFetchResponse({
        policies: [{ id: 'p1', name: 'Policy 1', category: 'test', description: 'desc', confidence: 0.8 }],
        categories: ['test'],
        total: 50,
        hasMore: false,
      });
      await usePolicyStore.getState().fetchPolicies();
      expect(usePolicyStore.getState().initialLoaded).toBe(true);

      // reset
      usePolicyStore.getState().reset();

      expect(usePolicyStore.getState().initialLoaded).toBe(false);
      expect(usePolicyStore.getState().policies).toHaveLength(0);
      expect(usePolicyStore.getState().totalCount).toBe(0);
    });
  });

  describe('totalCount', () => {
    it('should store totalCount from server response (data.total)', async () => {
      mockFetchResponse({
        policies: [{ id: 'p1', name: 'Policy 1', category: 'test', description: 'desc', confidence: 0.8 }],
        categories: ['test'],
        total: 250,
        hasMore: true,
      });

      await usePolicyStore.getState().fetchPolicies();

      const state = usePolicyStore.getState();
      expect(state.totalCount).toBe(250);
      expect(state.policies).toHaveLength(1);
    });

    it('should fallback to policies.length when total is not provided', async () => {
      mockFetchResponse({
        policies: [
          { id: 'p1', name: 'Policy 1', category: 'test', description: 'desc', confidence: 0.8 },
          { id: 'p2', name: 'Policy 2', category: 'test', description: 'desc2', confidence: 0.9 },
        ],
        categories: ['test'],
        hasMore: false,
      });

      await usePolicyStore.getState().fetchPolicies();

      expect(usePolicyStore.getState().totalCount).toBe(2);
    });

    it('should reset totalCount to 0 on reset()', () => {
      usePolicyStore.setState({ totalCount: 500 });
      usePolicyStore.getState().reset();
      expect(usePolicyStore.getState().totalCount).toBe(0);
    });
  });
});
