import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { ScreenScore, ScreenImpact } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';
import { useFlowStore } from '../../stores/flowStore';

interface BarChartProps {
  screenScores: ScreenScore[];
  affectedScreens?: ScreenImpact[];
}

/** 차트 데이터 아이템 */
interface ChartDataItem {
  name: string;
  score: number;
  grade: ScreenScore['grade'];
  screenId: string;
}

function ScreenBarChart({ screenScores, affectedScreens }: BarChartProps) {
  const navigate = useNavigate();
  const selectNode = useFlowStore((s) => s.selectNode);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const data: ChartDataItem[] = [...screenScores]
    .sort((a, b) => b.screenScore - a.screenScore)
    .map((screen) => ({
      name: screen.screenName,
      score: screen.screenScore,
      grade: screen.grade,
      screenId: screen.screenId,
    }));

  /** 헤더 "플로우차트에서 보기" 링크 클릭 */
  const handleFlowLink = useCallback(() => {
    navigate('/flow');
  }, [navigate]);

  /** 차트 레벨 onClick 핸들러 (Recharts CategoricalChartState) */
  const handleChartClick = useCallback(
    (nextState: { activePayload?: Array<{ payload: ChartDataItem }> } | null) => {
      if (!nextState?.activePayload || nextState.activePayload.length === 0) return;
      const clickedName = nextState.activePayload[0].payload.name;
      // 토글: 같은 바 다시 클릭 시 패널 닫기
      setSelectedBar((prev) => (prev === clickedName ? null : clickedName));
    },
    [],
  );

  /** 인라인 패널의 딥 링크 클릭: flowStore 연동 + navigate */
  const handleDeepLink = useCallback(
    (screenId: string) => {
      selectNode(`screen-${screenId}`);
      navigate('/flow');
    },
    [selectNode, navigate],
  );

  /** 선택된 화면의 ScreenImpact 데이터 */
  const selectedImpact = selectedBar
    ? affectedScreens?.find((s) => s.screenName === selectedBar)
    : null;

  /** 선택된 화면의 screenId (data에서 조회) */
  const selectedScreenId = selectedBar
    ? data.find((d) => d.name === selectedBar)?.screenId
    : null;

  /** FE/BE 작업 분류 */
  const feTasks = selectedImpact?.tasks.filter((t) => t.type === 'FE') ?? [];
  const beTasks = selectedImpact?.tasks.filter((t) => t.type === 'BE') ?? [];

  /** 선택된 화면의 등급 (ScreenScore 기준) */
  const selectedGrade = selectedBar
    ? data.find((d) => d.name === selectedBar)?.grade
    : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">화면별 영향도 점수</h3>
        <button
          type="button"
          onClick={handleFlowLink}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded px-1"
          aria-label="플로우차트에서 보기 페이지로 이동"
          data-testid="bar-chart-flow-link"
        >
          플로우차트에서 보기
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 차트 영역 */}
      <div className="h-64" data-testid="bar-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
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
                  fillOpacity={
                    selectedBar === null || selectedBar === entry.name ? 1 : 0.4
                  }
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
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

      {/* 인라인 패널 - 선택된 바가 있을 때 범례 아래에 표시 */}
      {selectedBar && (
        <div
          className="mt-4 pt-4 border-t border-gray-100"
          data-testid="bar-chart-inline-panel"
        >
          {/* 화면명 + 등급 뱃지 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-800">
              {selectedBar}
            </span>
            {selectedGrade && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  backgroundColor: GRADE_COLORS[selectedGrade].bg,
                  color: GRADE_COLORS[selectedGrade].text,
                  border: `1px solid ${GRADE_COLORS[selectedGrade].border}`,
                }}
                data-testid="bar-chart-grade-badge"
              >
                {selectedGrade}
              </span>
            )}
          </div>

          {/* FE/BE 작업 요약 */}
          {selectedImpact ? (
            <div className="space-y-2">
              {feTasks.length > 0 && (
                <div data-testid="bar-chart-fe-tasks">
                  <span className="text-xs font-medium text-blue-600">FE ({feTasks.length})</span>
                  <ul className="mt-1 space-y-0.5">
                    {feTasks.map((task) => (
                      <li key={task.id} className="text-xs text-gray-600 pl-2">
                        &bull; {task.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {beTasks.length > 0 && (
                <div data-testid="bar-chart-be-tasks">
                  <span className="text-xs font-medium text-green-600">BE ({beTasks.length})</span>
                  <ul className="mt-1 space-y-0.5">
                    {beTasks.map((task) => (
                      <li key={task.id} className="text-xs text-gray-600 pl-2">
                        &bull; {task.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {feTasks.length === 0 && beTasks.length === 0 && (
                <p className="text-xs text-gray-400">작업 항목이 없습니다.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">작업 상세 정보가 없습니다.</p>
          )}

          {/* 딥 링크: 플로우차트에서 자세히 보기 */}
          {selectedScreenId && (
            <button
              type="button"
              onClick={() => handleDeepLink(selectedScreenId)}
              className="mt-3 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded px-1"
              aria-label={`${selectedBar} 화면을 플로우차트에서 자세히 보기`}
              data-testid="bar-chart-deep-link"
            >
              플로우차트에서 자세히 보기
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ScreenBarChart;
