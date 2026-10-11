import React, { useEffect, useRef, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { copyRich, copyText } from "@/lib/clipboard";
import { answerHtml, answerPlainText, answerRootFor } from "@/lib/answerClipboard";

/**
 * Copy action for APPI answers and code blocks. The label turns into
 * "Tersalin" in place (announced politely) and returns after two seconds.
 * `rich` copies an answer with its formatting (HTML for editors, chat-friendly
 * text for plain destinations); code blocks copy their exact text.
 */
export default function AiCopyButton({ text = "", label = "Salin", className = "", tone = undefined, rich = false }) {
  const [state, setState] = useState("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (event) => {
    const root = rich ? answerRootFor(event.currentTarget) : null;
    const copied = root
      ? await copyRich({ html: answerHtml(root), text: answerPlainText(text) })
      : await copyText(text);
    setState(copied ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button type="button" className={`btn btn-ghost btn-sm btn-quiet aapm-ai-copy ${className}`} data-state={state} data-tone={tone} onClick={copy}>
      <AapmIcon name={state === "copied" ? "check" : "copy"} />
      <span aria-live="polite">{state === "copied" ? "Tersalin" : state === "failed" ? "Gagal menyalin" : label}</span>
    </button>
  );
}
