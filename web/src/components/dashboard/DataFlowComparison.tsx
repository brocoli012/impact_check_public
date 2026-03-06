import type { DataFlowChange } from '../../types';

export interface DataFlowComparisonProps {
  dataFlowChanges: DataFlowChange[];
}

function DataFlowComparison({ dataFlowChanges }: DataFlowComparisonProps) {
  if (!dataFlowChanges || dataFlowChanges.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="data-flow-comparison"
    >
      <h3 className="text-sm font-bold text-gray-900 mb-4">
        데이터 흐름 전/후 비교
      </h3>
      <div className="space-y-4">
        {dataFlowChanges.map((change, index) => (
          <div
            key={index}
            className="border border-gray-100 rounded-lg p-4"
            data-testid={`data-flow-item-${index}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                {change.area}
              </span>
              <span className="text-xs text-gray-500">{change.description}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 items-stretch">
              {/* Before */}
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Before</p>
                <p className="text-sm text-gray-700 leading-relaxed">{change.before}</p>
              </div>
              {/* Arrow */}
              {/* After */}
              <div className="bg-green-50 rounded-lg p-3 border border-green-100 relative">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1">After</p>
                <p className="text-sm text-gray-700 leading-relaxed">{change.after}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DataFlowComparison;
