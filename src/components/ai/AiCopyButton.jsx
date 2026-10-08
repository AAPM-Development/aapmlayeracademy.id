import React, { useEffect, useRef, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { copyText } from "@/lib/clipboard";

/**
 * Copy action for APPI answers and code blocks. The label turns into
 * "Tersalin" in place (announced politely) and returns after two seconds.
 */
export default function AiCopyButton({ text = "", label = "Salin", className = "", tone }) {
  const [state, setState] = useState("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const copied = await copyText(text);
    setState(copied ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button type="button" className={`aapm-ai-copy ${className}`} data-state={state} data-tone={tone} onClick={copy}>
      <AapmIcon name={state === "copied" ? "glyphCheck" : "copy"} />
      <span aria-live="polite">{state === "copied" ? "Tersalin" : state === "failed" ? "Gagal menyalin" : label}</span>
    </button>
  );
}
