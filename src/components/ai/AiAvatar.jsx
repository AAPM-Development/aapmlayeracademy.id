import React, { useEffect, useState } from "react";

const sizes = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-16 w-16",
};

// Every state is a deliberate pair: one character expression and one companion decor.
// This keeps the mascot expressive without multiplying it throughout the conversation.
const stateAssets = {
  idle: {
    avatar: "Asset%201.svg",
    decor: "Asset%2013.svg",
    label: "siap membantu",
  },
  thinking: {
    avatar: "Asset%205.svg",
    decor: "Asset%2017.svg",
    label: "menelaah konteks",
  },
  responding: {
    avatar: "Asset%2012.svg",
    decor: "Asset%2024.svg",
    label: "menyusun jawaban",
  },
  complete: {
    avatar: "Asset%209.svg",
    decor: "Asset%2021.svg",
    label: "jawaban selesai",
  },
  alert: {
    avatar: "Asset%2011.svg",
    decor: "Asset%2023.svg",
    label: "perlu perhatian",
  },
};

function AvatarPair({ state, phase }) {
  const assets = stateAssets[state] || stateAssets.idle;
  return (
    <>
      <img
        src={`/assets/avatar/${assets.avatar}`}
        alt=""
        className={`aapm-ai-presence__avatar aapm-ai-presence__avatar--${phase}`}
      />
      <img
        src={`/assets/avatar/${assets.decor}`}
        alt=""
        className={`aapm-ai-presence__decor aapm-ai-presence__decor--${phase}`}
      />
    </>
  );
}

export default function AiAvatar({
  size = "sm",
  state = "idle",
  className = "",
  decorative = false,
}) {
  const [visibleState, setVisibleState] = useState(state);
  const [leavingState, setLeavingState] = useState(null);

  useEffect(() => {
    if (state === visibleState) return undefined;
    setLeavingState(visibleState);
    const timer = window.setTimeout(() => {
      setVisibleState(state);
      setLeavingState(null);
    }, 170);
    return () => window.clearTimeout(timer);
  }, [state, visibleState]);

  const assets = stateAssets[visibleState] || stateAssets.idle;
  return (
    <span
      className={`aapm-ai-presence ${sizes[size] || sizes.sm} ${className}`}
      data-state={visibleState}
      aria-label={decorative ? undefined : `AI AAPM sedang ${assets.label}`}
      aria-hidden={decorative || undefined}
    >
      {leavingState ? (
        <AvatarPair
          key={`exit-${leavingState}`}
          state={leavingState}
          phase="exit"
        />
      ) : (
        <AvatarPair
          key={`enter-${visibleState}`}
          state={visibleState}
          phase="enter"
        />
      )}
    </span>
  );
}
