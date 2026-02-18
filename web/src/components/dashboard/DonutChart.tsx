import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Task } from '../../types';
import { TASK_TYPE_COLORS } from '../../utils/colors';

interface DonutChartProps {
  tasks: Task[];
}

/** ChevronRight 아이콘 (인라인 SVG) */
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DonutChart({ tasks }: DonutChartProps) {
  const navigate = useNavigate();

  const feCount = tasks.filter((t) => t.type === 'FE').length;
  const beCount = tasks.filter((t) => t.type === 'BE').length;

  const data = [
    { name: 'FE', value: feCount, color: TASK_TYPE_COLORS.FE },
    { name: 'BE', value: beCount, color: TASK_TYPE_COLORS.BE },
  ].filter((d) => d.value > 0);

  const total = feCount + beCount;

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">
            FE / BE 작업 비율
          </h3>
          <button
            data-testid="donut-header-link"
            onClick={() => navigate('/tickets')}
            aria-label="작업 목록 페이지로 이동"
            className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
          >
            작업 목록 보기
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-sm text-gray-400 text-center py-8">
          작업 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* 섹션 헤더: 타이틀 + 작업 목록 보기 링크 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          FE / BE 작업 비율
        </h3>
        <button
          data-testid="donut-header-link"
          onClick={() => navigate('/tickets')}
          aria-label="작업 목록 페이지로 이동"
          className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
        >
          작업 목록 보기
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 도넛 차트 */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) =>
                `${name}: ${value}건 (${Math.round((value / total) * 100)}%)`
              }
              onClick={(entry) => {
                if (entry && entry.name) {
                  navigate(`/tickets?type=${entry.name}`);
                }
              }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value}건 (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 하단: 전체 작업 목록 보기 링크 */}
      <div className="mt-3 pt-3 border-t border-gray-100 text-center">
        <button
          data-testid="donut-footer-link"
          onClick={() => navigate('/tickets')}
          aria-label="전체 작업 목록 보기 페이지로 이동"
          className="text-xs text-purple-600 hover:text-purple-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 rounded px-2 py-1"
        >
          전체 작업 목록 보기 →
        </button>
      </div>
    </div>
  );
}

export default DonutChart;
