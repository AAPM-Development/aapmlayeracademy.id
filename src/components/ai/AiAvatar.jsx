import React from "react";
import AppiMascot from "@/components/appi/AppiMascot";
import { cn } from "@/lib/utils";

const sizes = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 64,
};

// Chat states map onto APPI's moods, so the chat avatar, the launcher and
// every in-page APPI share one character and one animation language.
const moods = {
  idle: "idle",
  thinking: "think",
  responding: "talk",
  complete: "happy",
  success: "cheer",
  alert: "concerned",
};

const labels = {
  idle: "siap membantu",
  thinking: "menelaah konteks",
  responding: "menyusun jawaban",
  complete: "jawaban selesai",
  success: "berhasil membantu",
  alert: "perlu perhatian",
};

/** APPI in the chat: the mascot with the mood of the conversation state. */
export default function AiAvatar({ size = "sm", state = "idle", className = "", decorative = false }) {
  const pixels = sizes[size] || sizes.sm;
  return (
    <AppiMascot
      mood={moods[state] || "idle"}
      size={pixels}
      decor={pixels >= sizes.md}
      presence={false}
      className={cn("aapm-ai-presence", className)}
      label={decorative ? undefined : `APPI sedang ${labels[state] || labels.idle}`}
    />
  );
}
