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
 * 크로스 프로젝트 링크/그룹을 Mermaid flowchart 문법으로 변환
 *
 * @param links - 프로젝트 간 의존성 링크 목록
 * @param groups - 프로젝트 그룹 목록
 * @param options - 렌더 옵션
 * @returns Mermaid flowchart 문자열 (```mermaid 블록 포함)
 */
export declare function renderMermaid(links: ProjectLink[], groups: ProjectGroup[], options?: MermaidRenderOptions): string;
//# sourceMappingURL=mermaid-renderer.d.ts.map