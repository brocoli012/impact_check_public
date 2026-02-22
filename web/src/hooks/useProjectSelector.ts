/**
 * @module web/hooks/useProjectSelector
 * @description 프로젝트 전환 공통 훅 (REQ-014, TASK-115)
 * Header.tsx의 handleProjectSwitch 로직을 추출하여 공통 훅으로 제공한다.
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useResultStore } from '../stores/resultStore';
import { usePolicyStore } from '../stores/policyStore';
import { useFlowStore } from '../stores/flowStore';
import type { ProjectInfo } from '../types';

interface UseProjectSelectorReturn {
  /** 프로젝트 목록 */
  projects: ProjectInfo[];
  /** 현재 활성 프로젝트 ID */
  activeProjectId: string | null;
  /** 프로젝트 전환 (reset -> switch -> fetchAll) */
  switchProject: (projectId: string) => Promise<void>;
  /** 전환 진행 중 여부 */
  isLoading: boolean;
}

/**
 * 프로젝트 전환 공통 훅
 *
 * Header.tsx의 handleProjectSwitch와 동일한 로직:
 * 1. resultStore.reset(), policyStore.reset(), flowStore.reset() 호출
 * 2. projectStore.switchProject(projectId) 호출
 * 3. resultStore.fetchAllResults() 호출
 */
export function useProjectSelector(): UseProjectSelectorReturn {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projectSwitch = useProjectStore((s) => s.switchProject);

  const resetResult = useResultStore((s) => s.reset);
  const fetchAllResults = useResultStore((s) => s.fetchAllResults);
  const resetPolicy = usePolicyStore((s) => s.reset);
  const resetFlow = useFlowStore((s) => s.reset);

  const [isLoading, setIsLoading] = useState(false);

  const switchProject = useCallback(async (projectId: string) => {
    setIsLoading(true);
    try {
      // 1. 기존 데이터 초기화
      resetResult();
      resetPolicy();
      resetFlow();

      // 2. 프로젝트 전환
      await projectSwitch(projectId);

      // 3. 새 프로젝트 데이터 로드
      await fetchAllResults();
    } finally {
      setIsLoading(false);
    }
  }, [projectSwitch, resetResult, resetPolicy, resetFlow, fetchAllResults]);

  return {
    projects,
    activeProjectId,
    switchProject,
    isLoading,
  };
}
