import React, { useEffect, useRef, useState } from "react";

/**
 * The one live region for an answer in progress. Streaming tokens are never
 * announced; screen readers hear only that APPI started and finished.
 */
export default function StreamAnnouncer({ isStreaming }) {
  const [text, setText] = useState("");
  const wasStreaming = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      wasStreaming.current = true;
      setText("APPI sedang menjawab.");
      return;
    }
    if (wasStreaming.current) {
      wasStreaming.current = false;
      setText("APPI selesai menjawab.");
    }
  }, [isStreaming]);

  return (
    <div className="aapm-visually-hidden" role="status" aria-live="polite">
      {text}
    </div>
  );
}
