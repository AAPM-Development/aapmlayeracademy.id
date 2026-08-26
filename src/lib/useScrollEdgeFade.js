import { useCallback, useEffect, useState } from "react";

const EDGE_THRESHOLD = 2;

/**
 * Exposes the current scroll edges as data attributes on the scroll surface.
 * CSS can then render a fade only while more content exists in that direction.
 */
export default function useScrollEdgeFade({
  stateRef = null,
  enabled = true,
} = {}) {
  const [scrollElement, setScrollElement] = useState(null);
  const scrollRef = useCallback((node) => {
    setScrollElement(node);
  }, []);

  const updateScrollEdges = useCallback(() => {
    const stateElement = stateRef?.current || scrollElement;
    if (!scrollElement || !stateElement) return;

    const maxTop = Math.max(
      0,
      scrollElement.scrollHeight - scrollElement.clientHeight,
    );
    const maxLeft = Math.max(
      0,
      scrollElement.scrollWidth - scrollElement.clientWidth,
    );

    stateElement.dataset.scrollTop =
      scrollElement.scrollTop > EDGE_THRESHOLD ? "true" : "false";
    stateElement.dataset.scrollBottom =
      scrollElement.scrollTop < maxTop - EDGE_THRESHOLD ? "true" : "false";
    stateElement.dataset.scrollLeft =
      scrollElement.scrollLeft > EDGE_THRESHOLD ? "true" : "false";
    stateElement.dataset.scrollRight =
      scrollElement.scrollLeft < maxLeft - EDGE_THRESHOLD ? "true" : "false";
  }, [scrollElement, stateRef]);

  useEffect(() => {
    const stateElement = stateRef?.current;
    if (!enabled) {
      if (stateElement) {
        delete stateElement.dataset.scrollTop;
        delete stateElement.dataset.scrollBottom;
        delete stateElement.dataset.scrollLeft;
        delete stateElement.dataset.scrollRight;
      }
      return undefined;
    }

    if (!scrollElement) return undefined;

    let frameId = null;
    const scheduleUpdate = () => {
      if (typeof window === "undefined") {
        updateScrollEdges();
        return;
      }
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateScrollEdges);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleUpdate)
        : null;
    resizeObserver?.observe(scrollElement);
    if (scrollElement.firstElementChild) {
      resizeObserver?.observe(scrollElement.firstElementChild);
    }

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(scheduleUpdate)
        : null;
    mutationObserver?.observe(scrollElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    scrollElement.addEventListener("scroll", updateScrollEdges, {
      passive: true,
    });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      scrollElement.removeEventListener("scroll", updateScrollEdges);
      window.removeEventListener("resize", scheduleUpdate);
      const stateElement = stateRef?.current || scrollElement;
      delete stateElement.dataset.scrollTop;
      delete stateElement.dataset.scrollBottom;
      delete stateElement.dataset.scrollLeft;
      delete stateElement.dataset.scrollRight;
    };
  }, [enabled, scrollElement, stateRef, updateScrollEdges]);

  return scrollRef;
}
