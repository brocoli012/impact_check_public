/**
 * @module web/components/owners/OwnerCard
 * @description 담당자 카드 컴포넌트 - 시스템 담당자 정보 및 확인 필요 사항 표시
 */

import type { OwnerInfo } from '../../hooks/useOwners';
import EmailDraft from './EmailDraft';

/** 팀 아이콘 색상 맵 */
const TEAM_COLORS: Record<string, string> = {
  커머스팀: 'bg-blue-100 text-blue-700',
  페이먼트팀: 'bg-green-100 text-green-700',
  주문팀: 'bg-orange-100 text-orange-700',
};

function getTeamColor(team: string): string {
  return TEAM_COLORS[team] ?? 'bg-gray-100 text-gray-700';
}

interface OwnerCardProps {
  /** 담당자 정보 */
  owner: OwnerInfo;
}

function OwnerCard({ owner }: OwnerCardProps) {
  const teamColor = getTeamColor(owner.team);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
      {/* Header: Team icon + System name */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${teamColor}`}
          >
            {owner.team.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {owner.systemName}
            </h3>
            <p className="text-xs text-gray-500">{owner.team}</p>
          </div>
        </div>
      </div>

      {/* Owner info */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {owner.ownerName}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          {owner.ownerEmail}
        </span>
        {owner.slackChannel && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
            {owner.slackChannel}
          </span>
        )}
      </div>

      {/* Divider */}
      <hr className="my-3 border-gray-100" />

      {/* Tasks */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">
          확인 필요 사항
        </p>
        <ol className="space-y-1.5">
          {owner.relatedTasks.map((task, i) => (
            <li key={task.id} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="text-gray-400 font-medium min-w-[16px]">
                {i + 1}.
              </span>
              <div className="flex-1">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${
                    task.type === 'FE'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {task.type}
                </span>
                <span className="text-gray-800">{task.title}</span>
                <p className="text-gray-400 mt-0.5">{task.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Related screens */}
      {owner.affectedScreens.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-700 mb-1">
            영향받는 화면
          </p>
          <div className="flex flex-wrap gap-1">
            {owner.affectedScreens.map((screen) => (
              <span
                key={screen}
                className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600"
              >
                {screen}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related ticket IDs */}
      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">
          관련 티켓
        </p>
        <div className="flex flex-wrap gap-1">
          {owner.relatedTaskIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 text-xs text-purple-600 font-mono"
            >
              {id}
            </span>
          ))}
        </div>
      </div>

      {/* Email draft */}
      <EmailDraft draftText={owner.generatedEmailDraft} />
    </div>
  );
}

export default OwnerCard;
