/**
 * @module web/stores/__tests__/sharedEntityStore.test
 * @description sharedEntityStore 단위 테스트 (Phase D: TASK-111)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSharedEntityStore } from '../sharedEntityStore';

// fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('sharedEntityStore', () => {
  beforeEach(() => {
    // Reset store
    useSharedEntityStore.getState().reset();
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('should have empty tables and events', () => {
      const state = useSharedEntityStore.getState();
      expect(state.tables).toEqual([]);
      expect(state.events).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.searchResult).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchSharedEntities', () => {
    it('should fetch and set shared entities', async () => {
      const mockData = {
        tables: [{ name: 'orders', projects: ['proj-a', 'proj-b'], referenceCount: 2 }],
        events: [{ name: 'order-created', publishers: ['proj-a'], subscribers: ['proj-b'], referenceCount: 2 }],
        stats: { totalTables: 2, sharedTables: 1, totalEvents: 1, sharedEvents: 1, projectCount: 2 },
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockData),
      });

      await useSharedEntityStore.getState().fetchSharedEntities();

      const state = useSharedEntityStore.getState();
      expect(state.tables).toHaveLength(1);
      expect(state.tables[0].name).toBe('orders');
      expect(state.events).toHaveLength(1);
      expect(state.events[0].name).toBe('order-created');
      expect(state.stats).toBeDefined();
      expect(state.isLoading).toBe(false);
    });

    it('should set error on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useSharedEntityStore.getState().fetchSharedEntities();

      const state = useSharedEntityStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('searchReverse', () => {
    it('should search and set results', async () => {
      const mockData = {
        query: 'order',
        tables: [{ name: 'orders', refs: [] }],
        events: [{ name: 'order-created', refs: [] }],
        totalTables: 1,
        totalEvents: 1,
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockData),
      });

      await useSharedEntityStore.getState().searchReverse('order');

      const state = useSharedEntityStore.getState();
      expect(state.searchResult).toBeDefined();
      expect(state.searchResult!.query).toBe('order');
      expect(state.searchResult!.totalTables).toBe(1);
      expect(state.searchResult!.totalEvents).toBe(1);
    });

    it('should not search with empty query', async () => {
      await useSharedEntityStore.getState().searchReverse('');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not search with whitespace-only query', async () => {
      await useSharedEntityStore.getState().searchReverse('   ');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('clearSearch', () => {
    it('should clear search result', () => {
      // Set some search result first
      useSharedEntityStore.setState({
        searchResult: {
          query: 'test',
          tables: [],
          events: [],
          totalTables: 0,
          totalEvents: 0,
        },
      });

      useSharedEntityStore.getState().clearSearch();
      expect(useSharedEntityStore.getState().searchResult).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      useSharedEntityStore.setState({
        tables: [{ name: 'orders', projects: ['a'], referenceCount: 1 }],
        events: [],
        stats: { totalTables: 1, sharedTables: 0, totalEvents: 0, sharedEvents: 0, projectCount: 1 },
        searchResult: { query: 'x', tables: [], events: [], totalTables: 0, totalEvents: 0 },
        isLoading: true,
        error: 'some error',
      });

      useSharedEntityStore.getState().reset();

      const state = useSharedEntityStore.getState();
      expect(state.tables).toEqual([]);
      expect(state.events).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.searchResult).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
