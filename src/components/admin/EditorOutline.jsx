import React from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import AapmIcon from "@/components/icons/AapmIcon";
import { IconButton } from "@/components/primitives";
import { AddElementMenu } from "@/components/admin/EditorActionBar";

/**
 * The block list inside the Materi group. The composer renders it into the
 * outline's slot, so the order shown here is the order the canvas uses.
 */
export function EditorialOutlineList({ items = [], selectedId = "", onSelect = () => {}, onMove = () => {} }) {
  if (!items.length) return <p className="aapm-editor-outline__empty">Belum ada blok di materi.</p>;

  return (
    <DragDropContext
      onDragEnd={(result) => {
        if (!result.destination || result.destination.index === result.source.index) return;
        onMove(result.source.index, result.destination.index);
      }}
    >
      <Droppable droppableId="editor-outline-blocks">
        {(droppable) => (
          <ol ref={droppable.innerRef} {...droppable.droppableProps} className="aapm-editor-outline__list">
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(draggable, snapshot) => (
                  <li
                    ref={draggable.innerRef}
                    {...draggable.draggableProps}
                    className="aapm-editor-outline__item"
                    data-dragging={snapshot.isDragging ? "true" : undefined}
                    data-selected={item.id === selectedId ? "true" : undefined}
                  >
                    <span className="aapm-editor-outline__grip" aria-label={`Geser blok ${index + 1}`} {...draggable.dragHandleProps}>
                      <AapmIcon name="grip" />
                    </span>
                    <button
                      type="button"
                      className="aapm-editor-outline__target"
                      aria-current={item.id === selectedId ? "true" : undefined}
                      onClick={() => onSelect(item.id)}
                    >
                      <span className="aapm-editor-outline__index">{index + 1}</span>
                      <span className="aapm-editor-outline__text">
                        <span className="aapm-editor-outline__type">{item.label}</span>
                        <span className="aapm-editor-outline__detail">{item.detail}</span>
                      </span>
                    </button>
                  </li>
                )}
              </Draggable>
            ))}
            {droppable.placeholder}
          </ol>
        )}
      </Droppable>
    </DragDropContext>
  );
}

/**
 * Susun: the module's outline. Sections are the jump targets, and the Materi
 * group holds the blocks in order, so the learner's reading order is visible
 * and can be changed without scrolling the canvas.
 */
export default function EditorOutline({
  sections = [],
  activeSection = "",
  onNavigate = () => {},
  blockSlotRef = null,
  addGroups = [],
  onAddElement = null,
  asideRef = null,
  drawerOpen = false,
  onClose = () => {},
}) {
  return (
    <aside ref={asideRef} className="aapm-editor-outline" aria-label="Susun modul" role={drawerOpen ? "dialog" : undefined} aria-modal={drawerOpen ? true : undefined} tabIndex={drawerOpen ? -1 : undefined} data-editor-outline data-drawer-open={drawerOpen ? "true" : undefined}>
      <div className="aapm-editor-outline__head">
        <h2 className="aapm-text-overline m-0">Susun</h2>
        <IconButton className="aapm-editor-drawer-close" label="Tutup Susun" tooltip={false} icon="close" size="sm" onClick={onClose} />
      </div>
      <nav className="aapm-editor-outline__nav" aria-label="Bagian editor">
        {sections.map((section) => (
          <div key={section.id} className="aapm-editor-outline__group">
            <button
              type="button"
              className="aapm-editor-outline__section"
              aria-current={section.id === activeSection ? "step" : undefined}
              data-editor-section-link={section.id}
              onClick={() => onNavigate(section.id)}
            >
              {section.icon ? <AapmIcon name={section.icon} /> : null}
              <span>{section.label}</span>
            </button>
            {section.id === "module-section-content" ? <div ref={blockSlotRef} className="aapm-editor-outline__blocks" /> : null}
          </div>
        ))}
      </nav>
      {onAddElement && addGroups.length ? (
        <div className="aapm-editor-outline__add">
          <AddElementMenu groups={addGroups} onAddElement={onAddElement} />
        </div>
      ) : null}
    </aside>
  );
}
