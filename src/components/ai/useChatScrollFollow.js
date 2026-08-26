import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 32;

export default function useChatScrollFollow({
  content,
  activeKey = null,
  isStreaming = false,
}) {
  const viewportRef = useRef(null);
  const endRef = useRef(null);
  const shouldFollowRef = useRef(true);
  const hasContentRef = useRef(Boolean(content?.length));
  const frameRef = useRef(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD;
    viewport.dataset.scrollTop = viewport.scrollTop > 2 ? "true" : "false";
    viewport.dataset.scrollBottom =
      viewport.scrollTop < maxTop - 2 ? "true" : "false";
    viewport.dataset.scrollLeft = viewport.scrollLeft > 2 ? "true" : "false";
    viewport.dataset.scrollRight =
      viewport.scrollLeft < maxLeft - 2 ? "true" : "false";
    shouldFollowRef.current = atBottom;
    const shouldShowJump = !atBottom && hasContentRef.current;
    setShowJumpToLatest((current) =>
      current === shouldShowJump ? current : shouldShowJump,
    );
  }, []);

  const scrollToLatest = useCallback((behavior = "auto") => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({ top, behavior });
    } else {
      viewport.scrollTop = top;
    }
  }, []);

  const scheduleFollow = useCallback(
    (behavior = "auto") => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        if (!shouldFollowRef.current) {
          updateScrollState();
          return;
        }
        scrollToLatest(behavior);
        updateScrollState();
      });
    },
    [scrollToLatest, updateScrollState],
  );

  useEffect(() => {
    hasContentRef.current = Boolean(content?.length);
    if (!hasContentRef.current) setShowJumpToLatest(false);
  }, [content?.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => viewport.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  useEffect(() => {
    shouldFollowRef.current = true;
    setShowJumpToLatest(false);
    scheduleFollow();
  }, [activeKey, scheduleFollow]);

  useEffect(() => {
    scheduleFollow("auto");
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [content, isStreaming, scheduleFollow]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleResize = () => {
      if (shouldFollowRef.current) scheduleFollow("auto");
      else updateScrollState();
    };
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(viewport);
    if (viewport.firstElementChild) resizeObserver?.observe(viewport.firstElementChild);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", handleResize, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [scheduleFollow, updateScrollState]);

  const jumpToLatest = useCallback(() => {
    shouldFollowRef.current = true;
    setShowJumpToLatest(false);
    scrollToLatest(isStreaming ? "auto" : "smooth");
  }, [isStreaming, scrollToLatest]);

  return { viewportRef, endRef, showJumpToLatest, jumpToLatest };
}
