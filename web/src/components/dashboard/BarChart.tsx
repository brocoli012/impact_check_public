import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ScreenScore } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';

interface BarChartProps {
  screenScores: ScreenScore[];
}

function ScreenBarChart({ screenScores }: BarChartProps) {
  const data = screenScores
    .sort((a, b) => b.screenScore - a.screenScore)
    .map((screen) => ({
      name: screen.screenName,
      score: screen.screenScore,
      grade: screen.grade,
    }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        화면별 영향도 점수
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number) => [`${value}점`, '영향도 점수']}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={GRADE_COLORS[entry.grade]?.bar || '#94A3B8'}
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-3 justify-center">
        {(['Low', 'Medium', 'High', 'Critical'] as const).map((grade) => (
          <div key={grade} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: GRADE_COLORS[grade].bar }}
            />
            <span className="text-xs text-gray-500">{grade}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScreenBarChart;
