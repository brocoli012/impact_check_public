/**
 * @module web/utils/safeString
 * @description React #310 방지용 안전 문자열 변환 유틸리티
 * JSX에서 오브젝트가 직접 렌더링되는 것을 방지
 */

/**
 * 안전하게 문자열로 변환 (object인 경우 React error #310 방지)
 * - string/number/boolean → 그대로 문자열 변환
 * - object → 알려진 필드(keyword, name, label, content) 추출 또는 JSON.stringify
 * - null/undefined → 빈 문자열
 */
export function safeString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('keyword' in obj && typeof obj.keyword === 'string') return obj.keyword;
    if ('name' in obj && typeof obj.name === 'string') return obj.name;
    if ('label' in obj && typeof obj.label === 'string') return obj.label;
    if ('content' in obj && typeof obj.content === 'string') return obj.content;
    try { return JSON.stringify(value); } catch { return '[object]'; }
  }
  return String(value);
}
