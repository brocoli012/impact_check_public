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

function DonutChart({ tasks }: DonutChartProps) {
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
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          FE / BE 작업 비율
        </h3>
        <p className="text-sm text-gray-400 text-center py-8">
          작업 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        FE / BE 작업 비율
      </h3>
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
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
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
    </div>
  );
}

export default DonutChart;
