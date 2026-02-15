/**
 * @module web/components/flowchart
 * @description 플로우차트 컴포넌트 배럴 파일 - nodeTypes, edgeTypes 등록
 */

import RequirementNode from './RequirementNode';
import SystemNode from './SystemNode';
import ScreenNode from './ScreenNode';
import FeatureNode from './FeatureNode';
import ModuleNode from './ModuleNode';
import CheckNode from './CheckNode';
import PolicyNode from './PolicyNode';
import PolicyWarningNode from './PolicyWarningNode';
import CustomEdge from './CustomEdge';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** React Flow에 등록할 커스텀 노드 타입 맵 */
export const nodeTypes = {
  requirement: RequirementNode as any,
  system: SystemNode as any,
  screen: ScreenNode as any,
  feature: FeatureNode as any,
  module: ModuleNode as any,
  check: CheckNode as any,
  policy: PolicyNode as any,
  policyWarning: PolicyWarningNode as any,
};

/** React Flow에 등록할 커스텀 엣지 타입 맵 */
export const edgeTypes = {
  custom: CustomEdge as any,
};

/* eslint-enable @typescript-eslint/no-explicit-any */

export { default as FilterBar } from './FilterBar';
