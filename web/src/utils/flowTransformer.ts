/**
 * @module web/utils/flowTransformer
 * @description 분석 결과 데이터를 React Flow 노드/엣지로 변환
 * 5-레벨 계층: Requirement -> System -> Screen -> Feature -> Module
 * + Check, Policy, PolicyWarning 노드
 */

import type { Node, Edge } from '@xyflow/react';
import type { AnalysisResult, Grade, ScreenScore, TaskScore } from '../types';
import type {
  RequirementNodeData,
  SystemNodeData,
  ScreenNodeData,
  FeatureNodeData,
  ModuleNodeData,
  CheckNodeData,
  PolicyNodeData,
  PolicyWarningNodeData,
  EdgeType,
  CustomEdgeData,
} from '../components/flowchart/types';
import { getGradeFromScore } from './gradeUtils';
import type { FlowFilterState } from '../stores/flowStore';
import { safeString } from './safeString';

/** 변환 결과 */
export interface FlowTransformResult {
  nodes: Node[];
  edges: Edge[];
  /** 확장 가능한 노드 ID 목록 */
  expandableNodeIds: string[];
}

/**
 * AnalysisResult를 React Flow의 노드/엣지로 변환
 */
export function transformToFlow(
  result: AnalysisResult,
  expandedNodeIds: Set<string>,
  filter: FlowFilterState,
): FlowTransformResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const expandableNodeIds: string[] = [];

  // 검색 필터 함수
  const matchesSearch = (text: string): boolean => {
    if (!filter.searchQuery) return true;
    return text.toLowerCase().includes(filter.searchQuery.toLowerCase());
  };

  // 등급 필터 함수
  const matchesGrade = (grade: Grade): boolean => {
    return filter.gradeFilter.includes(grade);
  };

  // ── 1. Requirement 노드 (최상위) ──
  const reqId = `req-${result.analysisId}`;
  const reqNode: Node = {
    id: reqId,
    type: 'requirement',
    position: { x: 0, y: 0 },
    data: {
      label: safeString(result.specTitle),
      affectedSystemCount: result.affectedScreens.length,
      totalScore: result.totalScore,
      grade: result.grade,
    } satisfies RequirementNodeData,
  };
  nodes.push(reqNode);

  // ── 2. System 노드 (ownerNotifications에서 시스템 추출) ──
  // 시스템이 없으면 가상의 "기본 시스템" 생성
  const systemMap = new Map<string, { systemId: string; systemName: string; screenIds: string[] }>();

  if (result.ownerNotifications.length > 0) {
    for (const owner of result.ownerNotifications) {
      if (!systemMap.has(owner.systemId)) {
        systemMap.set(owner.systemId, {
          systemId: owner.systemId,
          systemName: owner.systemName,
          screenIds: [],
        });
      }
    }
  }

  // 화면을 시스템에 매핑 (간단히: ownerNotification의 relatedTaskIds와 매칭)
  const taskToScreenMap = new Map<string, string>();
  for (const screen of result.affectedScreens) {
    for (const task of screen.tasks) {
      taskToScreenMap.set(task.id, screen.screenId);
    }
  }

  const screenToSystemMap = new Map<string, string>();
  for (const owner of result.ownerNotifications) {
    for (const taskId of owner.relatedTaskIds) {
      const screenId = taskToScreenMap.get(taskId);
      if (screenId) {
        screenToSystemMap.set(screenId, owner.systemId);
        const sys = systemMap.get(owner.systemId);
        if (sys && !sys.screenIds.includes(screenId)) {
          sys.screenIds.push(screenId);
        }
      }
    }
  }

  // 시스템에 매핑되지 않은 화면 처리
  const unmappedScreens: string[] = [];
  for (const screen of result.affectedScreens) {
    if (!screenToSystemMap.has(screen.screenId)) {
      unmappedScreens.push(screen.screenId);
    }
  }

  if (unmappedScreens.length > 0) {
    const defaultSysId = 'sys-default';
    if (!systemMap.has(defaultSysId)) {
      systemMap.set(defaultSysId, {
        systemId: defaultSysId,
        systemName: '기본 시스템',
        screenIds: unmappedScreens,
      });
    } else {
      const sys = systemMap.get(defaultSysId)!;
      sys.screenIds.push(...unmappedScreens);
    }
    for (const sid of unmappedScreens) {
      screenToSystemMap.set(sid, defaultSysId);
    }
  }

  // 시스템이 아예 없으면 하나 만들기
  if (systemMap.size === 0) {
    const defaultSysId = 'sys-default';
    systemMap.set(defaultSysId, {
      systemId: defaultSysId,
      systemName: '기본 시스템',
      screenIds: result.affectedScreens.map((s) => s.screenId),
    });
    for (const screen of result.affectedScreens) {
      screenToSystemMap.set(screen.screenId, defaultSysId);
    }
  }

  // 시스템 노드 생성
  const screenScoreMap = new Map<string, ScreenScore>();
  for (const ss of result.screenScores) {
    screenScoreMap.set(ss.screenId, ss);
  }

  for (const [sysId, sysInfo] of systemMap) {
    // 시스템 총점 계산
    let sysTotalScore = 0;
    for (const sid of sysInfo.screenIds) {
      const ss = screenScoreMap.get(sid);
      if (ss) sysTotalScore += ss.screenScore;
    }
    const sysGrade = getGradeFromScore(sysTotalScore);

    if (!matchesGrade(sysGrade)) continue;

    const sysNodeId = `sys-${sysId}`;
    const sysNode: Node = {
      id: sysNodeId,
      type: 'system',
      position: { x: 0, y: 0 },
      data: {
        label: safeString(sysInfo.systemName),
        totalScore: sysTotalScore,
        grade: sysGrade,
        confidence: 'medium', // 기본값
      } satisfies SystemNodeData,
    };
    nodes.push(sysNode);

    // Requirement -> System 엣지
    edges.push(createEdge(reqId, sysNodeId, 'strong', result.grade));

    // ── 3. Screen 노드 ──
    for (const screenId of sysInfo.screenIds) {
      const screenImpact = result.affectedScreens.find((s) => s.screenId === screenId);
      const screenScore = screenScoreMap.get(screenId);
      if (!screenImpact || !screenScore) continue;

      if (!matchesGrade(screenScore.grade)) continue;

      // FE/BE 카운트
      const feTasks = screenImpact.tasks.filter((t) => t.type === 'FE');
      const beTasks = screenImpact.tasks.filter((t) => t.type === 'BE');

      // 필터 적용
      const filteredTasks = screenImpact.tasks.filter((t) => {
        if (filter.taskTypeFilter !== 'all' && t.type !== filter.taskTypeFilter) return false;
        if (filter.workTypeFilter !== 'all' && t.actionType !== filter.workTypeFilter) return false;
        return true;
      });

      if (filteredTasks.length === 0 && filter.taskTypeFilter !== 'all') continue;

      // 검색 필터
      const screenMatchesSearch =
        matchesSearch(screenImpact.screenName) ||
        screenImpact.tasks.some(
          (t) =>
            matchesSearch(t.title) ||
            t.affectedFiles.some((f) => matchesSearch(f)),
        );
      if (!screenMatchesSearch) continue;

      const hasChildren = filteredTasks.length > 0;
      const isExpanded = expandedNodeIds.has(screenId);
      expandableNodeIds.push(screenId);

      const screenNodeId = `screen-${screenId}`;
      const screenNode: Node = {
        id: screenNodeId,
        type: 'screen',
        position: { x: 0, y: 0 },
        data: {
          label: safeString(screenImpact.screenName),
          score: screenScore.screenScore,
          grade: screenScore.grade,
          feCount: feTasks.length,
          beCount: beTasks.length,
          hasChildren,
          expanded: isExpanded,
        } satisfies ScreenNodeData,
      };
      nodes.push(screenNode);

      // System -> Screen 엣지
      edges.push(createEdge(sysNodeId, screenNodeId, 'normal', screenScore.grade));

      // 확장된 상태에서만 자식 노드 표시
      if (isExpanded) {
        // ── 4. Feature 노드 (Task) ──
        for (const task of filteredTasks) {
          const taskScore = screenScore.taskScores.find(
            (ts: TaskScore) => ts.taskId === task.id,
          );
          const tGrade = taskScore ? taskScore.grade : getGradeFromScore(0);

          const featureNodeId = `feature-${task.id}`;
          const featureNode: Node = {
            id: featureNodeId,
            type: 'feature',
            position: { x: 0, y: 0 },
            data: {
              label: safeString(task.title),
              workType: task.actionType,
              score: taskScore ? taskScore.totalScore : 0,
              grade: tGrade,
              taskType: task.type,
            } satisfies FeatureNodeData,
          };
          nodes.push(featureNode);

          // Screen -> Feature 엣지
          edges.push(createEdge(screenNodeId, featureNodeId, 'normal', tGrade));

          // ── 5. Module 노드 (affectedFiles) ──
          for (let i = 0; i < task.affectedFiles.length; i++) {
            const rawFilePath = task.affectedFiles[i];
            const filePath = safeString(rawFilePath);
            const fileName = filePath.split('/').pop() || filePath;

            if (!matchesSearch(filePath) && !matchesSearch(task.title)) continue;

            const moduleNodeId = `module-${task.id}-${i}`;
            const moduleNode: Node = {
              id: moduleNodeId,
              type: 'module',
              position: { x: 0, y: 0 },
              data: {
                label: safeString(fileName),
                taskType: task.type,
                score: taskScore ? Math.round(taskScore.totalScore / task.affectedFiles.length) : 0,
                filePath,
              } satisfies ModuleNodeData,
            };
            nodes.push(moduleNode);

            // Feature -> Module 엣지
            edges.push(createEdge(featureNodeId, moduleNodeId, 'weak'));
          }

          // ── Check 노드 (planningChecks) ──
          for (let i = 0; i < task.planningChecks.length; i++) {
            const rawCheckText = task.planningChecks[i];
            const checkText = safeString(rawCheckText);
            // planningChecks에서 관련 Check 객체 찾기
            const relatedCheck = result.planningChecks.find(
              (c) => c.content === checkText || c.content.includes(checkText?.substring(0, 10) ?? ''),
            );
            const urgency = relatedCheck?.priority || 'medium';

            const checkNodeId = `check-${task.id}-${i}`;
            const checkNode: Node = {
              id: checkNodeId,
              type: 'check',
              position: { x: 0, y: 0 },
              data: {
                label: checkText,
                urgency,
              } satisfies CheckNodeData,
            };
            nodes.push(checkNode);

            // Feature -> Check 엣지
            edges.push(createEdge(featureNodeId, checkNodeId, 'weak'));
          }
        }
      }
    }
  }

  // ── Policy 노드 ──
  for (const policy of result.policyChanges) {
    const policyNodeId = `policy-${policy.id}`;
    const policyNode: Node = {
      id: policyNodeId,
      type: 'policy',
      position: { x: 0, y: 0 },
      data: {
        label: safeString(policy.policyName),
        description: safeString(policy.description),
        requiresReview: policy.requiresReview,
      } satisfies PolicyNodeData,
    };
    nodes.push(policyNode);

    // Requirement -> Policy 엣지
    edges.push(createEdge(reqId, policyNodeId, 'weak'));
  }

  // ── PolicyWarning 노드 ──
  for (const pw of result.policyWarnings) {
    const pwNodeId = `pw-${pw.id}`;
    // 관련 시스템 이름 찾기
    const relatedTaskId = pw.relatedTaskIds?.[0];
    const relatedScreenId = relatedTaskId ? taskToScreenMap.get(relatedTaskId) : undefined;
    const relatedSysId = relatedScreenId ? screenToSystemMap.get(relatedScreenId) : undefined;
    const relatedSys = relatedSysId ? systemMap.get(relatedSysId) : undefined;

    const pwNode: Node = {
      id: pwNodeId,
      type: 'policyWarning',
      position: { x: 0, y: 0 },
      data: {
        label: safeString(pw.message),
        policyName: safeString(pw.policyName),
        severity: pw.severity,
        relatedSystem: safeString(relatedSys?.systemName) || '알 수 없음',
      } satisfies PolicyWarningNodeData,
    };
    nodes.push(pwNode);

    // Requirement -> PolicyWarning 엣지
    edges.push(createEdge(reqId, pwNodeId, 'weak'));
  }

  return { nodes, edges, expandableNodeIds };
}

/**
 * 엣지 생성 헬퍼
 */
function createEdge(
  source: string,
  target: string,
  edgeType: EdgeType,
  sourceGrade?: Grade,
): Edge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'custom',
    data: {
      edgeType,
      sourceGrade,
    } satisfies CustomEdgeData,
  };
}
