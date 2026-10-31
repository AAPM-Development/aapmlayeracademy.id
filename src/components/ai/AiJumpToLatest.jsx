import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";

/** Back to the newest message; it sits at the bottom of the transcript's own frame. */
export default function AiJumpToLatest({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="aapm-chat-jump">
      <AapmIcon name="chevronDown" className="h-3.5 w-3.5 text-brand-orange" />
      Ke pesan terbaru
    </button>
  );
}
