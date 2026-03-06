import { useSearchParams } from 'react-router-dom';
import type { PolicyAudience } from '../../types';

interface PolicyAudienceTabsProps {
  activeView: PolicyAudience;
  onViewChange: (view: PolicyAudience) => void;
  plannerCount: number;
  developerCount: number;
}

const TABS: { value: PolicyAudience; label: string }[] = [
  { value: 'planner', label: '기획자' },
  { value: 'developer', label: '개발자' },
];

function PolicyAudienceTabs({ activeView, onViewChange, plannerCount, developerCount }: PolicyAudienceTabsProps) {
  const [, setSearchParams] = useSearchParams();

  const handleTabClick = (view: PolicyAudience) => {
    onViewChange(view);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', view);
      return next;
    });
  };

  const getCount = (view: PolicyAudience) => {
    return view === 'planner' ? plannerCount : developerCount;
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" data-testid="policy-audience-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => handleTabClick(tab.value)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === tab.value
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid={`audience-tab-${tab.value}`}
        >
          {tab.label}
          <span
            className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${
              activeView === tab.value
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {getCount(tab.value)}
          </span>
        </button>
      ))}
    </div>
  );
}

export default PolicyAudienceTabs;
