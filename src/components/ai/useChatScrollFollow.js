import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 72;

export default function useChatScrollFollow({ content, activeKey = null, isStreaming = false }) {
  const viewportRef = useRef(null);
  const endRef = useRef(null);
  const shouldFollowRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD;
    shouldFollowRef.current = atBottom;
    setShowJumpToLatest(!atBottom && Boolean(content?.length));
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
  }, [activeKey]);

  useEffect(() => {
    if (!shouldFollowRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({
        behavior: isStreaming ? "auto" : "smooth",
        block: "end",
      });
      updateScrollState();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [content, isStreaming, updateScrollState]);

  const jumpToLatest = useCallback(() => {
    shouldFollowRef.current = true;
    setShowJumpToLatest(false);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  return { viewportRef, endRef, showJumpToLatest, jumpToLatest };
}
