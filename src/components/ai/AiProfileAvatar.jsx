import React from "react";
import { cn } from "@/lib/utils";
import AiAvatar from "@/components/ai/AiAvatar";

const profileSizes = {
  xs: { frame: "h-8 w-8", avatar: "xs" },
  sm: { frame: "h-10 w-10", avatar: "sm" },
  md: { frame: "h-11 w-11", avatar: "md" },
};

export default function AiProfileAvatar({
  state = "idle",
  size = "sm",
  className = "",
  label = "APPI",
}) {
  const config = profileSizes[size] || profileSizes.sm;

  return (
    <span
      className={cn("aapm-ai-profile-avatar", config.frame, className)}
      data-state={state}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <AiAvatar size={config.avatar} state={state} decorative />
    </span>
  );
}
