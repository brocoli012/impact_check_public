import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResultStore } from '../stores/resultStore';
import { useLatestResult } from '../hooks/useAnalysisResult';
import ScoreHeader from '../components/dashboard/ScoreHeader';
import KpiCards from '../components/dashboard/KpiCards';
import ScreenBarChart from '../components/dashboard/BarChart';
import DonutChart from '../components/dashboard/DonutChart';
import ActionGuide from '../components/dashboard/ActionGuide';
import CriticalAlertBanner from '../components/dashboard/CriticalAlertBanner';
import AnalysisSummaryCard from '../components/dashboard/AnalysisSummaryCard';
import SpecSourcePanel from '../components/dashboard/SpecSourcePanel';
import CrossProjectDiagram from '../components/cross-project/CrossProjectDiagram';
import CrossProjectSummary from '../components/cross-project/CrossProjectSummary';
import type { ProjectLink } from '../components/cross-project/CrossProjectDiagram';
import type { ProjectGroup } from '../components/cross-project/CrossProjectSummary';
import { CONFIDENCE_COLORS } from '../utils/colors';
import type { ConfidenceGrade } from '../types';

/** 신뢰도 등급 배지 라벨 */
const CONFIDENCE_BADGE: Record<ConfidenceGrade, string> = {
  high: 'HC',
  medium: 'MC',
  low: 'LC',
  very_low: 'VLC',
};

function Dashboard() {
  useLatestResult();
  const navigate = useNavigate();

  const { currentResult, isLoading, error } = useResultStore();

  /** 신뢰도 경고 배너 - 시스템별 펼침/접힘 상태 */
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());

  /** 크로스 프로젝트 데이터 */
  const [crossProjectLinks, setCrossProjectLinks] = useState<ProjectLink[]>([]);
  const [crossProjectGroups, setCrossProjectGroups] = useState<ProjectGroup[]>([]);

  useEffect(() => {
    async function fetchCrossProjectData() {
      try {
        const [linksRes, groupsRes] = await Promise.all([
          fetch('/api/cross-project/links'),
          fetch('/api/cross-project/groups'),
        ]);
        const linksData = await linksRes.json();
        const groupsData = await groupsRes.json();
        setCrossProjectLinks(linksData.links || []);
        setCrossProjectGroups(groupsData.groups || []);
      } catch {
        // 크로스 프로젝트 데이터 로드 실패는 무시 (선택적 섹션)
      }
    }
    fetchCrossProjectData();
  }, []);

  /** 낮은 신뢰도 시스템 목록 */
  const lowConfSystems = useMemo(() => {
    if (!currentResult) return [];
    return currentResult.confidenceScores.filter(
      (c) => c.grade === 'low' || c.grade === 'very_low',
    );
  }, [currentResult]);

  /** 평균 신뢰도 */
  const avgConfidence = useMemo(() => {
    if (!currentResult || currentResult.confidenceScores.length === 0) return 0;
    const sum = currentResult.confidenceScores.reduce((acc, c) => acc + c.overallScore, 0);
    return Math.round((sum / currentResult.confidenceScores.length) * 100);
  }, [currentResult]);

  /** Impact Flow 데이터 (ScoreHeader용) */
  const impactFlow = useMemo(() => {
    if (!currentResult) return undefined;
    const actionCounts = { new: 0, modify: 0, config: 0 };
    for (const task of currentResult.tasks) {
      if (task.actionType in actionCounts) {
        actionCounts[task.actionType as keyof typeof actionCounts]++;
      }
    }
    return {
      actionCounts,
      affectedScreenCount: currentResult.affectedScreens.length,
      totalTaskCount: currentResult.tasks.length,
    };
  }, [currentResult]);

  /** Critical 정책 경고 (CriticalAlertBanner용) */
  const criticalPolicies = useMemo(() => {
    if (!currentResult) return [];
    return currentResult.policyWarnings.filter((w) => w.severity === 'critical');
  }, [currentResult]);

  /** High priority 기획 확인 (CriticalAlertBanner용) */
  const highPriorityChecks = useMemo(() => {
    if (!currentResult) return [];
    return currentResult.planningChecks.filter((c) => c.priority === 'high');
  }, [currentResult]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-500">분석 결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!currentResult) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-xl text-gray-400 mb-2">분석 결과가 없습니다</p>
          <p className="text-sm text-gray-500">
            먼저 분석을 실행해주세요: /impact analyze &lt;spec-file&gt;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      <CriticalAlertBanner
        criticalPolicies={criticalPolicies}
        highPriorityChecks={highPriorityChecks}
      />

      <ScoreHeader
        totalScore={currentResult.totalScore}
        grade={currentResult.grade}
        specTitle={currentResult.specTitle}
        analyzedAt={currentResult.analyzedAt}
        recommendation={currentResult.recommendation}
        impactFlow={impactFlow}
      />

      {currentResult.analysisSummary && (
        <AnalysisSummaryCard summary={currentResult.analysisSummary} />
      )}

      <ActionGuide
        grade={currentResult.grade}
        policyWarnings={currentResult.policyWarnings}
        planningChecks={currentResult.planningChecks}
        affectedScreens={currentResult.affectedScreens}
        tasks={currentResult.tasks}
        ownerNotifications={currentResult.ownerNotifications}
      />

      <KpiCards result={currentResult} />

      <div className="grid grid-cols-3 gap-6 items-start">
        <div className="col-span-2">
          <ScreenBarChart screenScores={currentResult.screenScores} affectedScreens={currentResult.affectedScreens} />
        </div>
        <div className="col-span-1">
          <DonutChart tasks={currentResult.tasks} />
        </div>
      </div>

      {/* SpecSourcePanel - 기획서 원문 (parsedSpec이 있을 때만) */}
      {currentResult.parsedSpec && (
        <SpecSourcePanel parsedSpec={currentResult.parsedSpec} tasks={currentResult.tasks} />
      )}

      {/* Confidence Warning Banner - 낮은 신뢰도 시스템이 있을 때만 표시 */}
      {lowConfSystems.length > 0 && (
        <div
          className="rounded-lg p-4 border"
          style={{ backgroundColor: '#FFF7ED', borderColor: '#FB923C' }}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: '#EA580C' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#9A3412' }}>
                낮은 신뢰도 시스템 {lowConfSystems.length}개 - 보완 가이드 확인
              </p>
              <ul className="mt-1 space-y-1">
                {lowConfSystems.map((sys) => {
                  const isExpanded = expandedSystems.has(sys.systemId);
                  return (
                    <li key={sys.systemId}>
                      <button
                        data-testid={`confidence-toggle-${sys.systemId}`}
                        onClick={() => {
                          setExpandedSystems((prev) => {
                            const next = new Set(prev);
                            if (next.has(sys.systemId)) {
                              next.delete(sys.systemId);
                            } else {
                              next.add(sys.systemId);
                            }
                            return next;
                          });
                        }}
                        aria-expanded={isExpanded}
                        className="text-xs font-medium flex items-center gap-1 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
                        style={{ color: '#C2410C' }}
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        {sys.systemName} ({Math.round(sys.overallScore * 100)}%)
                      </button>
                      {isExpanded && sys.recommendations && sys.recommendations.length > 0 && (
                        <div className="mt-1 ml-4 space-y-1" data-testid={`confidence-recommendations-${sys.systemId}`}>
                          <ul className="list-disc list-inside space-y-0.5">
                            {sys.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-xs" style={{ color: '#9A3412' }}>
                                {rec}
                              </li>
                            ))}
                          </ul>
                          <button
                            onClick={() => navigate('/policies')}
                            className="text-xs text-purple-600 hover:text-purple-800 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
                          >
                            정책 페이지에서 확인하기 →
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Confidence Status Section - 시스템별 신뢰도 바 */}
      {currentResult.confidenceScores.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">분석 신뢰도 현황</h3>
            <button
              data-testid="confidence-policy-link"
              onClick={() => navigate('/policies')}
              aria-label="정책 확인하기 페이지로 이동"
              className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
            >
              정책 확인하기
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div className="space-y-3">
            {currentResult.confidenceScores.map((cs) => {
              const percent = Math.round(cs.overallScore * 100);
              const color = CONFIDENCE_COLORS[cs.grade as ConfidenceGrade] ?? '#94A3B8';
              const badge = CONFIDENCE_BADGE[cs.grade as ConfidenceGrade] ?? cs.grade;
              return (
                <div key={cs.systemId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 font-medium">{cs.systemName}</span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {badge}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-gray-600">{percent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">평균 신뢰도</span>
            <span className="text-sm font-bold text-gray-700">{avgConfidence}%</span>
          </div>
        </div>
      )}

      {/* Score Criteria Summary - 점수 산출 기준 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">점수 산출 기준</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            개발 복잡도 35%
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            영향 범위 30%
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
            정책 변경 20%
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            의존성 위험도 15%
          </div>
        </div>
      </div>

      {/* Cross Project Impact Section - 크로스 프로젝트 영향 */}
      {(crossProjectLinks.length > 0 || crossProjectGroups.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">크로스 프로젝트 영향</h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <CrossProjectDiagram links={crossProjectLinks} />
            </div>
            <div className="col-span-1">
              <CrossProjectSummary links={crossProjectLinks} groups={crossProjectGroups} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
