import type { AnalysisResult } from '../../types';

interface KpiCardsProps {
  result: AnalysisResult;
}

interface KpiCardData {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}

function KpiCards({ result }: KpiCardsProps) {
  const feTasks = result.tasks.filter((t) => t.type === 'FE').length;
  const beTasks = result.tasks.filter((t) => t.type === 'BE').length;

  const cards: KpiCardData[] = [
    {
      label: '영향 화면',
      value: result.affectedScreens.length,
      subtitle: '개 화면',
      color: '#6366F1',
    },
    {
      label: '총 작업',
      value: result.tasks.length,
      subtitle: `FE ${feTasks} / BE ${beTasks}`,
      color: '#3B82F6',
    },
    {
      label: '기획 확인',
      value: result.planningChecks.length,
      subtitle: '건',
      color: '#F59E0B',
    },
    {
      label: '정책 경고',
      value: result.policyWarnings.length,
      subtitle: '건',
      color: '#EF4444',
    },
    {
      label: '확인 요청',
      value: result.ownerNotifications.length,
      subtitle: '명',
      color: '#8B5CF6',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
            {card.subtitle && (
              <p className="text-xs text-gray-400">{card.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default KpiCards;
