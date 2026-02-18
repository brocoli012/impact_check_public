/**
 * @module web/components/policies/PolicyDetail
 * @description 정책 상세 패널 컴포넌트
 * 정책 기본 정보, 관련 파일, 보강 주석 데이터(조건/변수/상수/제약/리뷰), 조건 분기 시각화, 영향 범위 그래프
 */

import type {
  PolicyDetail as PolicyDetailType,
  InferredPolicyDetail,
  PolicyCondition,
  PolicyVariable,
  PolicyConstant,
  PolicyConstraint,
  PolicyReviewItem,
} from '../../types';
import ConditionFlow from './ConditionFlow';
import PolicyGraph from './PolicyGraph';

interface PolicyDetailProps {
  /** 정책 상세 데이터 */
  policy: PolicyDetailType;
  /** 닫기 핸들러 */
  onClose: () => void;
}

/** 카테고리 매핑 (영어 → 한국어) */
const CATEGORY_MAP: Record<string, string> = {
  delivery: '배송',
  pricing: '가격',
  discount: '할인',
  membership: '회원',
  reward: '적립금',
  security: '보안',
  quality: '품질',
  return: '반품/교환',
  general: '일반',
};

/** 보강 주석에서 현재 정책에 해당하는 InferredPolicy 찾기 */
function findMatchingInferredPolicy(
  policy: PolicyDetailType,
): InferredPolicyDetail | null {
  if (!policy.annotation?.annotations) return null;

  const korCategory = CATEGORY_MAP[policy.category] || policy.category;

  for (const ann of policy.annotation.annotations) {
    for (const p of ann.policies) {
      // 이름 정확 매칭
      if (p.name === policy.name) return p;
      // 카테고리 매칭 (한국어 변환 후)
      if (p.category === korCategory) return p;
      // 부분 문자열 매칭
      if (
        p.name && policy.name && (
          p.name.includes(policy.name.slice(0, 6)) ||
          policy.name.includes(p.name.slice(0, 6))
        )
      ) return p;
    }
  }

  // 최종 fallback: 첫 번째 annotation의 첫 번째 policy 반환
  for (const ann of policy.annotation.annotations) {
    if (ann.policies.length > 0) {
      return ann.policies[0];
    }
  }

  return null;
}

/** 신뢰도 배지 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  let colorClass = 'bg-red-100 text-red-700';
  if (confidence >= 0.7) {
    colorClass = 'bg-green-100 text-green-700';
  } else if (confidence >= 0.4) {
    colorClass = 'bg-yellow-100 text-yellow-700';
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
      {percent}%
    </span>
  );
}

/** 심각도 배지 */
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[severity] || colors.info}`}>
      {severity}
    </span>
  );
}

/** 우선순위 배지 */
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  );
}

/** 섹션 제목 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
      {children}
    </h4>
  );
}

function PolicyDetailComponent({ policy, onClose }: PolicyDetailProps) {
  const inferred = findMatchingInferredPolicy(policy);
  const hasAnnotation = !!policy.annotation;

  // 보강 주석에서 추출한 데이터
  const conditions: PolicyCondition[] = inferred?.conditions || [];
  const inputVariables: PolicyVariable[] = inferred?.inputVariables || [];
  const constants: PolicyConstant[] = inferred?.constants || [];
  const constraints: PolicyConstraint[] = inferred?.constraints || [];
  const reviewItems: PolicyReviewItem[] = inferred?.reviewItems || [];

  return (
    <div className="w-96 shrink-0" data-testid="policy-detail">
      <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-20 max-h-[calc(100vh-140px)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">정책 상세</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="패널 닫기"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">정책명</p>
              <p className="text-sm font-medium text-gray-900">{policy.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">카테고리</p>
              <p className="text-sm text-gray-700">{policy.category}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">설명</p>
              <p className="text-sm text-gray-700">{policy.description}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">신뢰도</p>
              <ConfidenceBadge confidence={policy.confidence} />
            </div>
          </div>

          {/* 관련 파일 목록 */}
          {(policy.affectedFiles || []).length > 0 && (
            <div>
              <SectionTitle>관련 파일</SectionTitle>
              <div className="space-y-0.5">
                {(policy.affectedFiles || []).map((file) => (
                  <p key={file} className="text-[11px] text-gray-500 font-mono truncate" title={file}>
                    {file}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 보강 주석 데이터 영역 */}
          {hasAnnotation ? (
            <>
              {/* 조건 분기 시각화 */}
              <div>
                <SectionTitle>조건 분기</SectionTitle>
                <ConditionFlow conditions={conditions} />
              </div>

              {/* 입력 변수 */}
              {inputVariables.length > 0 && (
                <div>
                  <SectionTitle>입력 변수</SectionTitle>
                  <div className="space-y-1" data-testid="input-variables">
                    {inputVariables.map((v, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px]">
                        <span className="font-mono text-purple-600 shrink-0">{v.name}</span>
                        <span className="text-gray-400">({v.type})</span>
                        <span className="text-gray-600">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 상수 */}
              {constants.length > 0 && (
                <div>
                  <SectionTitle>상수</SectionTitle>
                  <div className="space-y-1" data-testid="constants-list">
                    {constants.map((c, idx) => (
                      <div key={idx} className="text-[11px] bg-gray-50 rounded p-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-indigo-600">{c.name}</span>
                          <span className="text-gray-400">=</span>
                          <span className="font-mono text-green-700">{c.value}</span>
                          <span className="text-gray-400 ml-auto text-[9px]">{c.source}</span>
                        </div>
                        <p className="text-gray-500 mt-0.5">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 제약사항 */}
              {constraints.length > 0 && (
                <div>
                  <SectionTitle>제약사항</SectionTitle>
                  <div className="space-y-1" data-testid="constraints-list">
                    {constraints.map((c, idx) => (
                      <div key={idx} className="text-[11px] border-l-2 border-amber-300 pl-2 py-0.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <SeverityBadge severity={c.severity} />
                          <span className="text-gray-600">{c.description}</span>
                        </div>
                        {c.recommendation && (
                          <p className="text-[10px] text-gray-400">
                            권장: {c.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 리뷰 항목 */}
              {reviewItems.length > 0 && (
                <div>
                  <SectionTitle>리뷰 항목</SectionTitle>
                  <div className="space-y-1.5" data-testid="review-items">
                    {reviewItems.map((item, idx) => (
                      <div key={idx} className="text-[11px] bg-purple-50 rounded p-2">
                        <div className="flex items-center gap-1 mb-0.5">
                          <PriorityBadge priority={item.priority} />
                          <span className="text-gray-400 text-[9px]">{item.category}</span>
                        </div>
                        <p className="text-gray-700">{item.question}</p>
                        {item.context && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{item.context}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3" data-testid="no-annotation-notice">
              <p className="text-xs text-gray-500 leading-relaxed">
                보강 주석을 생성하면 조건/변수/제약사항 등 상세 정보를 확인할 수 있습니다
              </p>
            </div>
          )}

          {/* 영향 범위 미니 그래프 */}
          <div>
            <SectionTitle>영향 범위</SectionTitle>
            <PolicyGraph
              policyName={policy.name}
              affectedFiles={policy.affectedFiles || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PolicyDetailComponent;
