/**
 * @module web/hooks/useSSE
 * @description Server-Sent Events (SSE) 훅 - 실시간 프로젝트 이벤트 수신
 * REQ-012 Phase 3: project-switched, analysis-completed 이벤트 처리
 */

import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useResultStore } from '../stores/resultStore';
import { usePolicyStore } from '../stores/policyStore';
import { useFlowStore } from '../stores/flowStore';

/**
 * SSE 이벤트 스트림에 연결하여 실시간 갱신을 수신하는 훅
 * App 레벨에서 1회 호출
 */
export function useSSE(): void {
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const resetResult = useResultStore((s) => s.reset);
  const fetchAllResults = useResultStore((s) => s.fetchAllResults);
  const resetPolicy = usePolicyStore((s) => s.reset);
  const resetFlow = useFlowStore((s) => s.reset);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // SSE 연결
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    // 프로젝트 전환 이벤트
    es.addEventListener('project-switched', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.projectId) {
          setActiveProjectId(data.projectId);
          // 데이터 초기화 및 재로드
          resetResult();
          resetPolicy();
          resetFlow();
          fetchAllResults();
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    });

    // 분석 완료 이벤트
    es.addEventListener('analysis-completed', () => {
      // 분석 결과 새로고침
      fetchAllResults();
      fetchProjects();
    });

    // 연결 이벤트
    es.addEventListener('connected', () => {
      // 연결 성공 시 프로젝트 목록 갱신
      fetchProjects();
    });

    // 에러 시 재연결 (EventSource 자동 재연결)
    es.onerror = () => {
      // EventSource는 자동 재연결하므로 별도 처리 불요
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [fetchProjects, setActiveProjectId, resetResult, fetchAllResults, resetPolicy, resetFlow]);
}
