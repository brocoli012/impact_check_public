/**
 * @module web/components/dashboard/SpecSourcePanel
 * @description 기획서 원문(parsedSpec)을 대시보드에서 확인할 수 있는 접힘형 4탭 패널
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  WebParsedSpec,
  WebRequirement,
  WebFeature,
  WebBusinessRule,
  Task,
} from '../../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SpecSourcePanelProps {
  parsedSpec: WebParsedSpec;
  tasks: Task[];
}

/* ------------------------------------------------------------------ */
/*  탭 타입                                                            */
/* ------------------------------------------------------------------ */

type TabKey = 'requirements' | 'features' | 'rules' | 'ambiguities';

interface TabDef {
  key: TabKey;
  label: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/*  우선순위 색상 매핑                                                   */
/* ------------------------------------------------------------------ */

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

/* ------------------------------------------------------------------ */
/*  액션타입 칩 스타일                                                   */
/* ------------------------------------------------------------------ */

const ACTION_TYPE_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  modify: 'bg-orange-100 text-orange-700',
  config: 'bg-gray-100 text-gray-700',
};

/* ------------------------------------------------------------------ */
/*  요구사항 카드                                                       */
/* ------------------------------------------------------------------ */

function RequirementCard({
  req,
  relatedTaskCount,
  onChipClick,
}: {
  req: WebRequirement;
  relatedTaskCount: number;
  onChipClick: (reqId: string) => void;
}) {
  const priorityStyle = PRIORITY_STYLES[req.priority] ?? 'bg-gray-100 text-gray-700';

  return (
    <div
      className="border border-gray-100 rounded-md p-3 mb-2 last:mb-0"
      data-testid={`requirement-card-${req.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-200 text-gray-600"
          data-testid={`requirement-id-${req.id}`}
        >
          {req.id}
        </span>
        <span className="text-sm font-bold text-gray-900">{req.name}</span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${priorityStyle}`}
          data-testid={`requirement-priority-${req.id}`}
        >
          {req.priority}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{req.description}</p>
      {req.relatedFeatures.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {req.relatedFeatures.map((fId) => (
            <span
              key={fId}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-600"
            >
              {fId}
            </span>
          ))}
        </div>
      )}
      {relatedTaskCount > 0 && (
        <button
          type="button"
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer"
          data-testid={`requirement-task-chip-${req.id}`}
          onClick={() => onChipClick(req.id)}
        >
          {`\uAD00\uB828 Task ${relatedTaskCount}\uAC1C`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  기능 카드                                                          */
/* ------------------------------------------------------------------ */

function FeatureCard({ feature }: { feature: WebFeature }) {
  const actionStyle = ACTION_TYPE_STYLES[feature.actionType] ?? 'bg-gray-100 text-gray-700';

  return (
    <div
      className="border border-gray-100 rounded-md p-3 mb-2 last:mb-0"
      data-testid={`feature-card-${feature.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-200 text-gray-600">
          {feature.id}
        </span>
        <span className="text-sm font-bold text-gray-900">{feature.name}</span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${actionStyle}`}
        >
          {feature.actionType}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-1">{feature.description}</p>
      <p className="text-xs text-gray-400 mb-2">
        {`\uB300\uC0C1 \uD654\uBA74: ${feature.targetScreen}`}
      </p>
      {feature.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {feature.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  비즈니스 규칙 행                                                    */
/* ------------------------------------------------------------------ */

function BusinessRuleRow({ rule }: { rule: WebBusinessRule }) {
  return (
    <div
      className="border border-gray-100 rounded-md p-3 mb-2 last:mb-0"
      data-testid={`rule-card-${rule.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-gray-200 text-gray-600">
          {rule.id}
        </span>
      </div>
      <p className="text-sm text-gray-700">{rule.description}</p>
      {rule.relatedFeatureIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {rule.relatedFeatureIds.map((fId) => (
            <span
              key={fId}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-600"
            >
              {fId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  모호점 행                                                          */
/* ------------------------------------------------------------------ */

function AmbiguityRow({ text, index }: { text: string; index: number }) {
  return (
    <div
      className="flex items-start gap-2 border border-yellow-100 rounded-md p-3 mb-2 last:mb-0 bg-yellow-50"
      data-testid={`ambiguity-item-${index}`}
    >
      <span className="text-yellow-500 shrink-0" aria-hidden="true">
        <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </span>
      <span className="text-sm text-gray-700">{text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  메인 컴포넌트                                                       */
/* ------------------------------------------------------------------ */

function SpecSourcePanel({ parsedSpec, tasks }: SpecSourcePanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('requirements');

  /* ---------- 탭 정의 ---------- */
  const tabs: TabDef[] = useMemo(
    () => [
      {
        key: 'requirements',
        label: `\uC694\uAD6C\uC0AC\uD56D(${parsedSpec.requirements.length})`,
        count: parsedSpec.requirements.length,
      },
      {
        key: 'features',
        label: `\uAE30\uB2A5(${parsedSpec.features.length})`,
        count: parsedSpec.features.length,
      },
      {
        key: 'rules',
        label: `\uBE44\uC988\uB2C8\uC2A4 \uADDC\uCE59(${parsedSpec.businessRules.length})`,
        count: parsedSpec.businessRules.length,
      },
      {
        key: 'ambiguities',
        label: `\uBAA8\uD638\uC810(${parsedSpec.ambiguities.length})`,
        count: parsedSpec.ambiguities.length,
      },
    ],
    [parsedSpec],
  );

  /* ---------- 요구사항별 관련 Task 수 계산 ---------- */
  const taskCountByReq = useMemo(() => {
    const map: Record<string, number> = {};
    for (const req of parsedSpec.requirements) {
      map[req.id] = tasks.filter(
        (t) => t.sourceRequirementIds?.includes(req.id),
      ).length;
    }
    return map;
  }, [parsedSpec.requirements, tasks]);

  /* ---------- 추적 칩 클릭 핸들러 ---------- */
  const handleTaskChipClick = useCallback(
    (reqId: string) => {
      navigate(`/tickets?requirement=${reqId}`);
    },
    [navigate],
  );

  /* ---------- 접힘 상태 요약 텍스트 ---------- */
  const summaryText = `\uAE30\uD68D\uC11C \uC6D0\uBB38: \uC694\uAD6C\uC0AC\uD56D ${parsedSpec.requirements.length}\uAC1C, \uAE30\uB2A5 ${parsedSpec.features.length}\uAC1C, \uADDC\uCE59 ${parsedSpec.businessRules.length}\uAC1C`;

  /* ---------- 탭 내용 렌더링 ---------- */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'requirements':
        if (parsedSpec.requirements.length === 0) {
          return <p className="text-sm text-gray-400">요구사항이 없습니다.</p>;
        }
        return parsedSpec.requirements.map((req) => (
          <RequirementCard
            key={req.id}
            req={req}
            relatedTaskCount={taskCountByReq[req.id] ?? 0}
            onChipClick={handleTaskChipClick}
          />
        ));

      case 'features':
        if (parsedSpec.features.length === 0) {
          return <p className="text-sm text-gray-400">기능이 없습니다.</p>;
        }
        return parsedSpec.features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ));

      case 'rules':
        if (parsedSpec.businessRules.length === 0) {
          return <p className="text-sm text-gray-400">비즈니스 규칙이 없습니다.</p>;
        }
        return parsedSpec.businessRules.map((rule) => (
          <BusinessRuleRow key={rule.id} rule={rule} />
        ));

      case 'ambiguities':
        if (parsedSpec.ambiguities.length === 0) {
          return <p className="text-sm text-gray-400">모호점이 없습니다.</p>;
        }
        return parsedSpec.ambiguities.map((text, i) => (
          <AmbiguityRow key={i} text={text} index={i} />
        ));
    }
  };

  /* ---------- 접힘 상태 ---------- */
  if (!expanded) {
    return (
      <div
        className="bg-white rounded-lg border border-gray-200 p-5"
        data-testid="spec-source-panel"
      >
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors w-full text-left"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          data-testid="spec-toggle-btn"
        >
          <svg
            className="w-4 h-4 text-gray-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span data-testid="spec-summary-text">{summaryText}</span>
        </button>
      </div>
    );
  }

  /* ---------- 펼침 상태 ---------- */
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="spec-source-panel"
    >
      {/* 헤더: 접힘 버튼 */}
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors w-full text-left mb-4"
        onClick={() => setExpanded(false)}
        aria-expanded={true}
        data-testid="spec-toggle-btn"
      >
        <svg
          className="w-4 h-4 text-gray-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <span data-testid="spec-summary-text">{summaryText}</span>
      </button>

      {/* 탭 바 */}
      <div
        className="flex gap-1 border-b border-gray-200 mb-4"
        role="tablist"
        aria-label="기획서 원문 탭"
        data-testid="spec-tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`px-3 py-2 text-sm font-medium transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-b-2 border-purple-500 text-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.key)}
            data-testid={`spec-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div
        role="tabpanel"
        className="max-h-[400px] overflow-y-auto"
        data-testid={`spec-tabpanel-${activeTab}`}
      >
        {renderTabContent()}
      </div>
    </div>
  );
}

export default SpecSourcePanel;
