import type { Grade } from '../../types';
import { getGradeColors, getGradeLabel, formatDate } from '../../utils/gradeUtils';

interface ScoreHeaderProps {
  totalScore: number;
  grade: Grade;
  specTitle: string;
  analyzedAt: string;
  recommendation: string;
}

function ScoreHeader({ totalScore, grade, specTitle, analyzedAt, recommendation }: ScoreHeaderProps) {
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
    </div>
  );
}

export default ScoreHeader;
