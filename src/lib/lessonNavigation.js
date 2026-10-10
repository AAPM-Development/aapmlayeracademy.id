/** Reading navigation is independent from academic completion and retakes. */
export function lessonNavigation(sections, activeSection) {
  const index = Math.max(0, sections.findIndex((section) => section.id === activeSection));
  return {
    index,
    previous: sections[index - 1] || null,
    next: sections[index + 1] || null,
    atEnd: index === sections.length - 1,
  };
}

/** Scroll the lesson's panel only. scrollIntoView also scrolls hidden ancestors. */
export function scrollLessonSection(panel, target, behavior = "smooth") {
  if (!panel || !target || !panel.contains(target)) return;
  panel.scrollTo({
    top: Math.max(0, panel.scrollTop + target.getBoundingClientRect().top - panel.getBoundingClientRect().top),
    behavior,
  });
}
