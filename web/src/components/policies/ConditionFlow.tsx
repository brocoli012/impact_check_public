/**
 * @module web/components/policies/ConditionFlow
 * @description 조건 분기 시각화 컴포넌트 - HTML/CSS 기반 트리 구조
 * 들여쓰기 + 색상 코딩 방식으로 if/then 구조를 시각적으로 구분
 */

import type { PolicyCondition } from '../../types';

interface ConditionFlowProps {
  /** 조건 분기 목록 */
  conditions: PolicyCondition[];
}

/** 조건 유형별 스타일 */
const CONDITION_STYLES: Record<
  PolicyCondition['type'],
  { bg: string; border: string; label: string; labelColor: string }
> = {
  if: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    label: 'IF',
    labelColor: 'text-blue-700 bg-blue-100',
  },
  else_if: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    label: 'ELSE IF',
    labelColor: 'text-amber-700 bg-amber-100',
  },
  else: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    label: 'ELSE',
    labelColor: 'text-gray-700 bg-gray-100',
  },
};

function ConditionFlow({ conditions }: ConditionFlowProps) {
  if (!conditions || conditions.length === 0) {
    return (
      <div data-testid="condition-flow-empty" className="text-xs text-gray-400 py-2">
        조건 분기 정보가 없습니다
      </div>
    );
  }

  // 순서대로 정렬
  const sorted = [...conditions].sort((a, b) => a.order - b.order);

  return (
    <div data-testid="condition-flow" className="space-y-1.5">
      {sorted.map((cond, idx) => {
        const style = CONDITION_STYLES[cond.type] || CONDITION_STYLES.else;
        const indent = cond.type === 'if' ? 0 : 1;

        return (
          <div
            key={idx}
            data-testid={`condition-${cond.type}-${cond.order}`}
            className={`rounded border-l-3 ${style.bg} ${style.border} p-2`}
            style={{ marginLeft: indent * 12 }}
          >
            {/* 조건 유형 라벨 */}
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${style.labelColor}`}
                data-testid="condition-label"
              >
                {style.label}
              </span>
              {cond.condition && (
                <span className="text-[11px] text-gray-600 font-mono truncate">
                  {cond.condition}
                </span>
              )}
            </div>

            {/* 결과 */}
            <div className="flex items-start gap-1 ml-1">
              <span className="text-[10px] text-green-600 font-semibold shrink-0 mt-px">
                THEN
              </span>
              <span className="text-[11px] text-gray-700 leading-relaxed">
                {cond.result}
              </span>
            </div>

            {/* 결과값 */}
            {cond.resultValue && (
              <div className="ml-1 mt-0.5">
                <span className="text-[10px] text-gray-400 font-mono">
                  = {cond.resultValue}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ConditionFlow;
