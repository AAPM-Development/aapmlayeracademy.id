import React, { useEffect, useRef, useState } from "react";

/**
 * The one live region for an answer in progress. Streaming tokens are never
 * announced; screen readers hear only that APPI started and how it ended.
 */
export default function StreamAnnouncer({ isStreaming, failed = false, stopped = false }) {
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
      if (stopped) setText("Jawaban APPI dihentikan.");
      else setText(failed ? "Jawaban APPI belum selesai. Coba kirim ulang." : "APPI selesai menjawab.");
    }
  }, [failed, isStreaming, stopped]);

  return (
    <div className="aapm-visually-hidden" role="status" aria-live="polite">
      {text}
    </div>
  );
}
