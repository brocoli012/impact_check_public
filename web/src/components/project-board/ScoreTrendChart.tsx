/**
 * @module web/components/project-board/ScoreTrendChart
 * @description TASK-134: 분석 결과의 점수 추이를 라인 차트로 표시
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { ResultSummary } from '../../types';

interface ScoreTrendChartProps {
  results: ResultSummary[];
}

/** 차트 데이터 아이템 */
interface ChartItem {
  date: string;
  score: number;
  title: string;
}

function ScoreTrendChart({ results }: ScoreTrendChartProps) {
  // 최근 10건 (오래된 순 정렬)
  const chartData: ChartItem[] = results
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: formatShortDate(r.analyzedAt),
      score: r.totalScore,
      title: r.specTitle,
    }));

  if (chartData.length < 2) {
    return (
      <div
        data-testid="score-trend-empty"
        className="bg-white rounded-lg border border-gray-200 p-6"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">점수 추이</h3>
        <div className="flex items-center justify-center h-[160px] text-sm text-gray-400">
          데이터가 충분하지 않습니다
        </div>
      </div>
    );
  }

  return (
    <div data-testid="score-trend-chart" className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-4">점수 추이</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const data = payload[0].payload as ChartItem;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[160px]">
                    {data.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{data.date}</p>
                  <p className="text-sm font-bold text-purple-600 mt-1">{data.score}점</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={{ fill: '#8B5CF6', r: 3 }}
            activeDot={{ fill: '#7C3AED', r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 짧은 날짜 포맷 */
function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return dateStr;
  }
}

export default ScoreTrendChart;
