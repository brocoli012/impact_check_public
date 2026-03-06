/**
 * @module web/components/dashboard/CurrentProblemsSection
 * @description 현재 시스템 문제점 불릿 리스트 섹션
 */

export interface CurrentProblemsSectionProps {
  problems: string[];
}

function CurrentProblemsSection({ problems }: CurrentProblemsSectionProps) {
  if (!problems || problems.length === 0) return null;

  return (
    <div
      id="section-problems"
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="current-problems-section"
    >
      <h3 className="text-sm font-bold text-gray-900 mb-3">현재 문제점</h3>
      <ul className="space-y-2">
        {problems.map((problem, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-sm text-gray-700"
            data-testid={`problem-item-${index}`}
          >
            <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-400 shrink-0" aria-hidden="true" />
            <span>{problem}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CurrentProblemsSection;
