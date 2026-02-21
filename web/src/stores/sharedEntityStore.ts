/**
 * @module web/stores/sharedEntityStore
 * @description Zustand 상태 관리 - 공유 엔티티/이벤트 역추적 스토어
 * Phase D: TASK-111
 */

import { create } from 'zustand';

/** 테이블 참조 */
export interface TableReference {
  projectId: string;
  entityName: string;
  filePath: string;
  columns: string[];
  accessPattern: 'read' | 'write' | 'read-write';
}

/** 이벤트 참조 */
export interface EventReference {
  projectId: string;
  role: 'publisher' | 'subscriber';
  handler: string;
  filePath: string;
  topic?: string;
}

/** 공유 테이블 요약 */
export interface SharedTableSummary {
  name: string;
  projects: string[];
  referenceCount: number;
}

/** 공유 이벤트 요약 */
export interface SharedEventSummary {
  name: string;
  publishers: string[];
  subscribers: string[];
  referenceCount: number;
}

/** 역추적 검색 결과 */
export interface ReverseSearchResult {
  query: string;
  tables: Array<{ name: string; refs: TableReference[] }>;
  events: Array<{ name: string; refs: EventReference[] }>;
  totalTables: number;
  totalEvents: number;
}

/** 공유 엔티티 통계 */
export interface SharedEntityStats {
  totalTables: number;
  sharedTables: number;
  totalEvents: number;
  sharedEvents: number;
  projectCount: number;
}

/** 스토어 상태 */
interface SharedEntityState {
  /** 공유 테이블 목록 */
  tables: SharedTableSummary[];
  /** 공유 이벤트 목록 */
  events: SharedEventSummary[];
  /** 통계 */
  stats: SharedEntityStats | null;
  /** 역추적 검색 결과 */
  searchResult: ReverseSearchResult | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;

  /** 공유 엔티티 로드 */
  fetchSharedEntities: () => Promise<void>;
  /** 역추적 검색 */
  searchReverse: (query: string) => Promise<void>;
  /** 검색 결과 초기화 */
  clearSearch: () => void;
  /** 데이터 초기화 */
  reset: () => void;
}

export const useSharedEntityStore = create<SharedEntityState>((set) => ({
  tables: [],
  events: [],
  stats: null,
  searchResult: null,
  isLoading: false,
  error: null,

  fetchSharedEntities: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/shared-entities');
      const data = await response.json();
      set({
        tables: data.tables || [],
        events: data.events || [],
        stats: data.stats || null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch shared entities',
        isLoading: false,
      });
    }
  },

  searchReverse: async (query: string) => {
    if (!query.trim()) return;
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/reverse/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      set({
        searchResult: data,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to search',
        isLoading: false,
      });
    }
  },

  clearSearch: () => set({ searchResult: null }),

  reset: () => set({
    tables: [],
    events: [],
    stats: null,
    searchResult: null,
    isLoading: false,
    error: null,
  }),
}));
