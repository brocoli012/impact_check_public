/**
 * @module web/pages/Owners
 * @description 확인 요청 안내 페이지 - 영향받는 시스템 담당자 목록 및 이메일 초안
 */

import { useResultStore } from '../stores/resultStore';
import { useEnsureResult } from '../hooks/useEnsureResult';
import { useOwners } from '../hooks/useOwners';
import OwnerCard from '../components/owners/OwnerCard';
import ProjectSelector from '../components/common/ProjectSelector';
import EmptyResultGuide from '../components/common/EmptyResultGuide';

function Owners() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const { owners, totalTeams, specTitle } = useOwners();

  if (!currentResult) {
    return (
      <div className="space-y-6">
        <ProjectSelector />
        <EmptyResultGuide
          description="기획서를 선택하면 확인 요청 대상 담당자를 확인할 수 있습니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ProjectSelector */}
      <ProjectSelector />

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          확인 요청 안내
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {specTitle}
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-purple-600">
              {totalTeams}
            </span>
            <span className="text-sm text-gray-600">개 팀</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {owners.length}
            </span>
            <span className="text-sm text-gray-600">명 담당자</span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          이 기획의 영향을 받는 시스템 담당자에게 아래 내용을 확인 요청하세요.
        </p>
      </div>

      {/* Owner cards */}
      {owners.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          확인 요청할 담당자가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {owners.map((owner) => (
            <OwnerCard key={owner.id} owner={owner} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Owners;
