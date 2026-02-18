/**
 * @module web/stores/policyStore
 * @description Zustand 상태 관리 - 정책(Policy) 데이터 스토어
 */

import { create } from 'zustand';
import type { Policy, PolicyDetail } from '../types';

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
  /** 선택된 요구사항 필터 */
  selectedRequirement: string | null;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;

  /** 정책 목록 조회 */
  fetchPolicies: (projectId: string) => Promise<void>;
  /** 정책 상세 조회 */
  fetchPolicyDetail: (projectId: string, policyId: string) => Promise<void>;
  /** 검색어 설정 */
  setSearchQuery: (query: string) => void;
  /** 카테고리 필터 설정 */
  setSelectedCategory: (category: string | null) => void;
  /** 요구사항 필터 설정 */
  setSelectedRequirement: (reqId: string | null) => void;
  /** 선택 초기화 */
  clearSelection: () => void;
}

/** 정책 스토어 */
export const usePolicyStore = create<PolicyState>()((set) => ({
  policies: [],
  selectedPolicy: null,
  categories: [],
  searchQuery: '',
  selectedCategory: null,
  selectedRequirement: null,
  loading: false,
  error: null,

  fetchPolicies: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ projectId });
      const response = await fetch(`/api/policies?${params.toString()}`);
      const data = await response.json();
      const policies: Policy[] = (data.policies || []).map((p: any) => ({
        ...p,
        affectedFiles: p.affectedFiles || [p.file].filter(Boolean),
        relatedTaskIds: p.relatedTaskIds || [],
        source: p.source || 'comment',
      }));

      // 카테고리 목록 추출
      const categorySet = new Set<string>();
      for (const policy of policies) {
        if (policy.category) {
          categorySet.add(policy.category);
        }
      }

      set({
        policies,
        categories: Array.from(categorySet).sort(),
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '정책 목록을 불러올 수 없습니다.',
        loading: false,
      });
    }
  },

  fetchPolicyDetail: async (projectId: string, policyId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/policies/${policyId}?projectId=${projectId}`);
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
        set({ selectedPolicy: policyDetail, loading: false });
      } else {
        throw new Error(data.error || '정책을 찾을 수 없습니다.');
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '정책 상세를 불러올 수 없습니다.',
        loading: false,
      });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSelectedCategory: (category: string | null) => set({ selectedCategory: category }),

  setSelectedRequirement: (reqId: string | null) => set({ selectedRequirement: reqId }),

  clearSelection: () => set({ selectedPolicy: null }),
}));
