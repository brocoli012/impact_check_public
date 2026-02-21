/**
 * @module web/stores/projectStore
 * @description Zustand 상태 관리 - 멀티 프로젝트 스토어 (REQ-012)
 * 프로젝트 목록 조회, 활성 프로젝트 전환, SSE 이벤트 수신
 */

import { create } from 'zustand';
import type { ProjectInfo } from '../types';

/** 프로젝트 스토어 상태 */
interface ProjectState {
  /** 프로젝트 목록 */
  projects: ProjectInfo[];
  /** 활성 프로젝트 ID */
  activeProjectId: string | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;

  /** 프로젝트 목록 조회 */
  fetchProjects: () => Promise<void>;
  /** 활성 프로젝트 전환 */
  switchProject: (projectId: string) => Promise<void>;
  /** 활성 프로젝트 ID 설정 (SSE 이벤트 수신 시) */
  setActiveProjectId: (projectId: string) => void;
  /** 스토어 초기화 */
  reset: () => void;
}

/** 프로젝트 스토어 */
export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      set({
        projects: data.projects || [],
        activeProjectId: data.activeProject || null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '프로젝트 목록을 불러올 수 없습니다.',
        isLoading: false,
      });
    }
  },

  switchProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '프로젝트 전환에 실패했습니다.');
      }

      const data = await response.json();
      set({
        activeProjectId: data.activeProject,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '프로젝트 전환에 실패했습니다.',
        isLoading: false,
      });
    }
  },

  setActiveProjectId: (projectId: string) => {
    set({ activeProjectId: projectId });
  },

  reset: () => {
    set({
      projects: [],
      activeProjectId: null,
      isLoading: false,
      error: null,
    });
  },
}));
