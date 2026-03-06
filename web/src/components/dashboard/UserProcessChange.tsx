import type { ProcessChange } from '../../types';

export interface UserProcessChangeProps {
  processChanges: ProcessChange[];
}

function UserProcessChange({ processChanges }: UserProcessChangeProps) {
  if (!processChanges || processChanges.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="user-process-change"
    >
      <h3 className="text-sm font-bold text-gray-900 mb-4">
        사용자 프로세스 변경
      </h3>
      <div className="space-y-6">
        {processChanges.map((process, pIdx) => (
          <div
            key={pIdx}
            className="border border-gray-100 rounded-lg p-4"
            data-testid={`process-item-${pIdx}`}
          >
            <h4 className="text-sm font-semibold text-gray-800 mb-3">
              {process.processName}
            </h4>
            <div className="space-y-3">
              {/* Before steps */}
              <div>
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Before</p>
                <StepFlow steps={process.before} changedSteps={process.changedSteps} variant="before" />
              </div>
              {/* After steps */}
              <div>
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2">After</p>
                <StepFlow steps={process.after} changedSteps={process.changedSteps} variant="after" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepFlow({ steps, changedSteps, variant }: {
  steps: string[];
  changedSteps: number[];
  variant: 'before' | 'after';
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, idx) => {
        const isChanged = changedSteps.includes(idx);
        const bgClass = isChanged
          ? variant === 'before'
            ? 'bg-red-100 border-red-300 text-red-800'
            : 'bg-green-100 border-green-300 text-green-800'
          : 'bg-gray-50 border-gray-200 text-gray-600';

        return (
          <div key={idx} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center px-2 py-1 rounded border text-xs ${bgClass}`}
              data-testid={`step-${variant}-${idx}`}
            >
              {step}
            </span>
            {idx < steps.length - 1 && (
              <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default UserProcessChange;
