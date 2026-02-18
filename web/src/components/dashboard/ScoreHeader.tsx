import type { Grade } from '../../types';
import { getGradeColors, getGradeLabel, formatDate } from '../../utils/gradeUtils';

export interface ImpactFlowData {
  actionCounts: { new: number; modify: number; config: number };
  affectedScreenCount: number;
  totalTaskCount: number;
}

interface ScoreHeaderProps {
  totalScore: number;
  grade: Grade;
  specTitle: string;
  analyzedAt: string;
  recommendation: string;
  impactFlow?: ImpactFlowData;
}

/** Flow Strip 내 액션 타입 칩 설정 */
const ACTION_CHIP_CONFIG: Array<{
  key: keyof ImpactFlowData['actionCounts'];
  label: string;
  bgClass: string;
  textClass: string;
}> = [
  { key: 'new', label: '신규', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  { key: 'modify', label: '수정', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { key: 'config', label: '설정', bgClass: 'bg-gray-100', textClass: 'text-gray-600' },
];

function FlowStrip({ impactFlow }: { impactFlow: ImpactFlowData }) {
  const chips = ACTION_CHIP_CONFIG.filter((c) => impactFlow.actionCounts[c.key] > 0);

  return (
    <div
      data-testid="flow-strip"
      className="bg-gray-50 rounded-md px-3 py-2 flex items-center gap-2 flex-wrap"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          data-testid={`flow-chip-${chip.key}`}
          className={`${chip.bgClass} ${chip.textClass} text-xs font-medium px-2 py-0.5 rounded`}
        >
          {chip.label} {impactFlow.actionCounts[chip.key]}
        </span>
      ))}
      {chips.length > 0 && <span className="text-gray-400" aria-hidden="true">&rarr;</span>}
      <span data-testid="flow-screen-count" className="text-xs text-gray-600 font-medium">
        영향 화면 {impactFlow.affectedScreenCount}개
      </span>
      <span className="text-gray-400" aria-hidden="true">&rarr;</span>
      <span data-testid="flow-task-count" className="text-xs text-gray-600 font-medium">
        총 작업 {impactFlow.totalTaskCount}개
      </span>
    </div>
  );
}

function ScoreHeader({ totalScore, grade, specTitle, analyzedAt, recommendation, impactFlow }: ScoreHeaderProps) {
  const colors = getGradeColors(grade);
  const gradeLabel = getGradeLabel(grade);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{specTitle}</h2>
          <p className="text-sm text-gray-500">
            분석 시각: {formatDate(analyzedAt)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">종합 점수</p>
            <p className="text-4xl font-bold" style={{ color: colors.text }}>
              {totalScore}
            </p>
          </div>
          <div
            className="px-4 py-2 rounded-lg border-2 text-center min-w-[100px]"
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
              color: colors.text,
            }}
          >
            <p className="text-lg font-bold">{grade}</p>
            <p className="text-xs">{gradeLabel}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-600">{recommendation}</p>
      {impactFlow && <div className="mt-3"><FlowStrip impactFlow={impactFlow} /></div>}
    </div>
  );
}

export default ScoreHeader;
