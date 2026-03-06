/**
 * @module web/components/dashboard/SectionAnchorBar
 * @description PRD 8섹션으로 스크롤 이동하는 sticky 앵커 바
 */

import { useState, useEffect, useCallback } from 'react';

export interface SectionDef {
  id: string;
  label: string;
  visible: boolean;
}

export interface SectionAnchorBarProps {
  sections: SectionDef[];
}

function SectionAnchorBar({ sections }: SectionAnchorBarProps) {
  const [activeId, setActiveId] = useState<string>('');
  const visibleSections = sections.filter((s) => s.visible);

  useEffect(() => {
    if (visibleSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    );

    for (const section of visibleSections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [visibleSections]);

  const handleClick = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  if (visibleSections.length === 0) return null;

  return (
    <div
      className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-6 px-6 py-2"
      data-testid="section-anchor-bar"
    >
      <nav className="flex gap-1 overflow-x-auto" aria-label="섹션 네비게이션">
        {visibleSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => handleClick(section.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              activeId === section.id
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            data-testid={`anchor-${section.id}`}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default SectionAnchorBar;
