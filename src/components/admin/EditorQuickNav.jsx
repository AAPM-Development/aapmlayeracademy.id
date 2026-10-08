import React, { useEffect, useRef } from "react";
import AapmIcon from "@/components/icons/AapmIcon";

/**
 * Jump links to the editor's sections, shown above the canvas. The outline
 * rail replaces this row when the Susun phase lands.
 */
export default function EditorQuickNav({
  sections = [],
  activeSection = "",
  onNavigate = () => {},
}) {
  const sectionNavRef = useRef(null);

  // Keep the active section link visible when the row scrolls on phones.
  useEffect(() => {
    sectionNavRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSection]);

  return (
    <nav ref={sectionNavRef} className="aapm-editor-section-nav" aria-label="Bagian editor">
      {sections.map((section, index) => (
        <button
          key={section.id}
          type="button"
          className="aapm-editor-section-link"
          aria-current={section.id === activeSection ? "step" : undefined}
          title={section.detail ? `${section.label}: ${section.detail} (Alt+${index + 1})` : section.label}
          data-editor-section-link={section.id}
          onClick={() => onNavigate(section.id)}
        >
          {section.icon ? <AapmIcon name={section.icon} /> : null}
          {section.shortLabel || section.label}
        </button>
      ))}
    </nav>
  );
}
