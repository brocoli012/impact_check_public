/**
 * @module web/stores/policyStore
 * @description Zustand 상태 관리 - 정책(Policy) 데이터 스토어
 * InfiniteScroll 지원: fetchPolicies (초기 50건) + fetchMorePolicies (50건씩 추가)
 */

import { create } from 'zustand';
import type { Policy, PolicyDetail } from '../types';
import { useProjectStore } from './projectStore';

/** 한 번에 로드할 정책 수 */
const PAGE_SIZE = 50;

/** 정책 스토어 상태 */
interface PolicyState {
  /** 정책 목록 */
  policies: Policy[];
  /** 선택된 정책 상세 */
  selectedPolicy: PolicyDetail | null;
  /** 카테고리 목록 */
  categories: string[];
  /** 검색어 */
  searchQuery: string;
  /** 선택된 카테고리 필터 */
  selectedCategory: string | null;
  /** 선택된 소스 필터 */
  selectedSource: string | null;
  /** 선택된 요구사항 필터 */
  selectedRequirement: string | null;
  /** 로딩 상태 */
  loading: boolean;
  /** 초기 데이터 로드 완료 여부 (재조회 시 loading 억제용) */
  initialLoaded: boolean;
  /** 상세 조회 로딩 상태 */
  loadingDetail: boolean;
  /** 추가 로딩 상태 (더 불러오기) */
  loadingMore: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 전체 정책 수 (서버 기준) */
  totalCount: number;
  /** 추가 페이지 존재 여부 */
  hasMore: boolean;
  /** 현재 오프셋 */
  currentOffset: number;

  /** 정책 목록 초기 조회 (50건) */
  fetchPolicies: (projectId?: string) => Promise<void>;
  /** 추가 정책 로드 (다음 50건) */
  fetchMorePolicies: () => Promise<void>;
  /** 정책 상세 조회 */
  fetchPolicyDetail: (projectId: string, policyId: string) => Promise<void>;
  /** 검색어 설정 */
  setSearchQuery: (query: string) => void;
  /** 카테고리 필터 설정 */
  setSelectedCategory: (category: string | null) => void;
  /** 소스 필터 설정 */
  setSelectedSource: (source: string | null) => void;
  /** 요구사항 필터 설정 */
  setSelectedRequirement: (reqId: string | null) => void;
  /** 선택 초기화 */
  clearSelection: () => void;
  /** 데이터 초기화 (프로젝트 전환 시) */
  reset: () => void;
}

/** API 응답에서 Policy 매핑 */
function mapPolicy(p: any): Policy {
  return {
    ...p,
    affectedFiles: p.affectedFiles || [p.file].filter(Boolean),
    relatedTaskIds: p.relatedTaskIds || [],
    source: p.source || 'comment',
  };
}

/** 정책 스토어 */
export const usePolicyStore = create<PolicyState>()((set, get) => ({
  policies: [],
  selectedPolicy: null,
  categories: [],
  searchQuery: '',
  selectedCategory: null,
  selectedSource: null,
  selectedRequirement: null,
  loading: false,
  initialLoaded: false,
  loadingDetail: false,
  loadingMore: false,
  error: null,
  totalCount: 0,
  hasMore: false,
  currentOffset: 0,

  fetchPolicies: async (projectId?: string) => {
    const { initialLoaded } = get();
    // 초기 로드 완료 후 재조회 시에는 loading을 true로 설정하지 않음 (UI 깜빡임 방지)
    set({ loading: !initialLoaded, error: null });
    try {
      const params = new URLSearchParams();
      // projectId 우선순위: 인자 > activeProjectId
      const resolvedProjectId = projectId || useProjectStore.getState().activeProjectId;
      if (resolvedProjectId) params.set('projectId', resolvedProjectId);
      params.set('offset', '0');
      params.set('limit', String(PAGE_SIZE));

      const response = await fetch(`/api/policies?${params.toString()}`);
      const data = await response.json();
      const policies: Policy[] = (data.policies || []).map(mapPolicy);

      // 카테고리 목록은 서버에서 전체 기준으로 반환
      const categories: string[] = data.categories || [];

      set({
        policies,
        categories,
        totalCount: data.total || policies.length,
        hasMore: data.hasMore ?? false,
        currentOffset: policies.length,
        loading: false,
        initialLoaded: true,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '정책 목록을 불러올 수 없습니다.',
        loading: false,
      });
    }
  },

  fetchMorePolicies: async () => {
    const { loadingMore, hasMore, currentOffset } = get();
    if (loadingMore || !hasMore) return;

    set({ loadingMore: true });
    try {
      const params = new URLSearchParams();
      const activeProjectId = useProjectStore.getState().activeProjectId;
      if (activeProjectId) params.set('projectId', activeProjectId);
      params.set('offset', String(currentOffset));
      params.set('limit', String(PAGE_SIZE));

      const response = await fetch(`/api/policies?${params.toString()}`);
      const data = await response.json();
      const newPolicies: Policy[] = (data.policies || []).map(mapPolicy);

      set((state) => ({
        policies: [...state.policies, ...newPolicies],
        hasMore: data.hasMore ?? false,
        currentOffset: state.currentOffset + newPolicies.length,
        loadingMore: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '추가 정책을 불러올 수 없습니다.',
        loadingMore: false,
      });
    }
  },

  fetchPolicyDetail: async (projectId: string, policyId: string) => {
    const resolvedProjectId = projectId || useProjectStore.getState().activeProjectId;
    if (!resolvedProjectId) {
      set({ error: '프로젝트가 선택되지 않았습니다.', loadingDetail: false });
      return;
    }
    set({ loadingDetail: true, error: null });
    try {
      const response = await fetch(`/api/policies/${policyId}?projectId=${resolvedProjectId}`);
      const data = await response.json();
      if (data.policy) {
        const policyDetail: PolicyDetail = {
          ...data.policy,
          // 기본값 설정 (API가 제공하지 않는 필드)
          rules: data.policy.rules || [],
          changeHistory: data.policy.changeHistory || [],
          relatedPolicies: data.policy.relatedPolicies || [],
          affectedFiles: data.policy.affectedFiles || data.policy.relatedComponents || [],
          relatedTaskIds: data.policy.relatedTaskIds || [],
          confidence: data.policy.confidence || 0,
          // 보강 주석 데이터
          annotation: data.annotation || null,
        };
        set({ selectedPolicy: policyDetail, loadingDetail: false });
      } else {
        throw new Error(data.error || '정책을 찾을 수 없습니다.');
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '정책 상세를 불러올 수 없습니다.',
        loadingDetail: false,
      });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSelectedCategory: (category: string | null) => set({ selectedCategory: category }),

  setSelectedSource: (source: string | null) => set({ selectedSource: source }),

  setSelectedRequirement: (reqId: string | null) => set({ selectedRequirement: reqId }),

  clearSelection: () => set({ selectedPolicy: null }),

  reset: () => set({
    policies: [],
    selectedPolicy: null,
    categories: [],
    searchQuery: '',
    selectedCategory: null,
    selectedSource: null,
    selectedRequirement: null,
    loading: false,
    initialLoaded: false,
    loadingDetail: false,
    loadingMore: false,
    error: null,
    totalCount: 0,
    hasMore: false,
    currentOffset: 0,
  }),
}));
