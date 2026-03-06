/**
 * @module web/components/project-board/ProjectNotesCard
 * @description T3-06: 프로젝트 유의사항/메모 카드
 * project.notes 배열을 표시, 비어있으면 숨김
 */

interface ProjectNotesCardProps {
  notes?: string[];
}

export default function ProjectNotesCard({ notes }: ProjectNotesCardProps) {
  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="project-notes-card"
      className="bg-white rounded-lg border border-gray-200 p-4"
    >
      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        프로젝트 유의사항
      </h3>
      <ul className="space-y-2">
        {notes.map((note, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-xs text-gray-600"
          >
            <span className="shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-purple-300" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
