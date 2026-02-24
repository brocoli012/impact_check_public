/**
 * @module utils/mermaid-renderer
 * @description 크로스 프로젝트 링크/그룹을 Mermaid flowchart 문법으로 변환
 */

import { ProjectLink, ProjectGroup } from '../core/cross-project/types';

export interface MermaidRenderOptions {
  direction?: 'LR' | 'TB' | 'RL' | 'BT';
  includeGroups?: boolean;
  linkTypeFilter?: string[];
}

/**
 * 노드 ID에서 Mermaid에 안전하지 않은 특수문자를 제거/치환
 * Mermaid 노드 ID는 알파벳, 숫자, 언더스코어만 안전하므로 하이픈 등을 치환
 */
function sanitizeNodeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * 링크 타입에 따른 화살표 스타일 및 라벨 반환
 */
function getArrowStyle(type: string): { arrow: string; label: string } {
  switch (type) {
    case 'api-consumer':
    case 'api-provider':
      return { arrow: '-->', label: 'api' };
    case 'shared-library':
    case 'shared-types':
      return { arrow: '-.->',  label: 'shared' };
    case 'event-publisher':
    case 'event-subscriber':
      return { arrow: '==>', label: 'event' };
    case 'shared-db':
      return { arrow: '-->', label: 'shared-db' };
    default:
      return { arrow: '-->', label: type };
  }
}

/**
 * 크로스 프로젝트 링크/그룹을 Mermaid flowchart 문법으로 변환
 *
 * @param links - 프로젝트 간 의존성 링크 목록
 * @param groups - 프로젝트 그룹 목록
 * @param options - 렌더 옵션
 * @returns Mermaid flowchart 문자열 (```mermaid 블록 포함)
 */
export function renderMermaid(
  links: ProjectLink[],
  groups: ProjectGroup[],
  options?: MermaidRenderOptions,
): string {
  const direction = options?.direction ?? 'LR';
  const includeGroups = options?.includeGroups ?? true;
  const linkTypeFilter = options?.linkTypeFilter;

  // 링크 타입 필터 적용
  const filteredLinks = linkTypeFilter
    ? links.filter(l => linkTypeFilter.includes(l.type))
    : links;

  // 모든 프로젝트 ID 수집
  const allProjectIds = new Set<string>();
  for (const link of filteredLinks) {
    allProjectIds.add(link.source);
    allProjectIds.add(link.target);
  }

  const lines: string[] = [];
  lines.push('```mermaid');
  lines.push(`flowchart ${direction}`);

  if (includeGroups && groups.length > 0) {
    // 그룹별로 subgraph 블록 생성
    const renderedInGroup = new Set<string>();

    for (const group of groups) {
      // 이 그룹에 속하면서 실제 링크에 등장하는 프로젝트만 포함
      const groupProjects = group.projects.filter(p => allProjectIds.has(p));
      if (groupProjects.length === 0) continue;

      lines.push(`  subgraph ${group.name}`);
      for (const projectId of groupProjects) {
        const safeId = sanitizeNodeId(projectId);
        lines.push(`    ${safeId}[${projectId}]`);
        renderedInGroup.add(projectId);
      }
      lines.push('  end');
    }

    // 그룹 미소속 프로젝트는 최상위에 배치
    for (const projectId of allProjectIds) {
      if (!renderedInGroup.has(projectId)) {
        const safeId = sanitizeNodeId(projectId);
        lines.push(`  ${safeId}[${projectId}]`);
      }
    }
  } else {
    // 그룹 없이 모든 프로젝트를 최상위에 배치
    for (const projectId of allProjectIds) {
      const safeId = sanitizeNodeId(projectId);
      lines.push(`  ${safeId}[${projectId}]`);
    }
  }

  // 링크(엣지) 렌더링
  for (const link of filteredLinks) {
    const sourceId = sanitizeNodeId(link.source);
    const targetId = sanitizeNodeId(link.target);
    const { arrow, label } = getArrowStyle(link.type);
    const autoSuffix = link.autoDetected ? '(auto)' : '';
    const fullLabel = autoSuffix ? `${label}${autoSuffix}` : label;
    lines.push(`  ${sourceId} ${arrow}|${fullLabel}| ${targetId}`);
  }

  lines.push('```');

  return lines.join('\n');
}
