/**
 * @module web/utils/domainColors
 * @description 도메인 태그 색상 유틸리티 - ProjectCard와 ProjectStatusBanner에서 공유
 */

export const DOMAIN_COLORS = [
  { bg: '#DBEAFE', text: '#1D4ED8' },  // blue
  { bg: '#E0E7FF', text: '#4338CA' },  // indigo
  { bg: '#CCFBF1', text: '#0F766E' },  // teal
  { bg: '#FEF3C7', text: '#92400E' },  // amber
  { bg: '#FCE7F3', text: '#9D174D' },  // pink
  { bg: '#F3E8FF', text: '#6B21A8' },  // purple
  { bg: '#ECFDF5', text: '#065F46' },  // emerald
  { bg: '#F1F5F9', text: '#334155' },  // slate
];

export function getDomainColorIndex(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = ((hash << 5) - hash) + domain.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % DOMAIN_COLORS.length;
}
