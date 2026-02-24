/**
 * @module web/utils/linkTypeConstants
 * @description 링크 타입별 색상/라벨 상수 (크로스 프로젝트 공통)
 * TASK-111: CrossProjectDiagram에서 분리하여 다중 컴포넌트에서 재사용
 */

/** 링크 타입별 색상 매핑 */
export const LINK_TYPE_COLORS: Record<string, string> = {
  'api-consumer': '#3B82F6',    // blue
  'api-provider': '#10B981',    // green
  'shared-library': '#8B5CF6',  // purple
  'shared-types': '#F59E0B',    // amber
  'event-publisher': '#EF4444', // red
  'event-subscriber': '#EC4899', // pink
};

/** 링크 타입 라벨 */
export const LINK_TYPE_LABELS: Record<string, string> = {
  'api-consumer': 'API Consumer',
  'api-provider': 'API Provider',
  'shared-library': 'Shared Lib',
  'shared-types': 'Shared Types',
  'event-publisher': 'Event Pub',
  'event-subscriber': 'Event Sub',
};
