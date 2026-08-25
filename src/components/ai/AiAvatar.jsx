import React, { useEffect, useState } from "react";

const sizes = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-16 w-16",
};

// Each frame is one deliberate avatar + decor pair. The component never renders
// a collage of mascots: it softly cycles through the supplied assets so APPI
// feels present without taking over the transcript.
const stateAssets = {
  idle: {
    frames: [
      { avatar: "Asset%201.svg", decor: "Asset%2013.svg" },
      { avatar: "Asset%202.svg", decor: "Asset%2014.svg" },
      { avatar: "Asset%203.svg", decor: "Asset%2015.svg" },
    ],
    interval: 4800,
    label: "siap membantu",
  },
  thinking: {
    frames: [
      { avatar: "Asset%205.svg", decor: "Asset%2017.svg" },
      { avatar: "Asset%206.svg", decor: "Asset%2018.svg" },
      { avatar: "Asset%207.svg", decor: "Asset%2019.svg" },
    ],
    interval: 2200,
    label: "menelaah konteks",
  },
  responding: {
    frames: [
      { avatar: "Asset%208.svg", decor: "Asset%2020.svg" },
      { avatar: "Asset%209.svg", decor: "Asset%2021.svg" },
      { avatar: "Asset%2010.svg", decor: "Asset%2022.svg" },
    ],
    interval: 1800,
    label: "menyusun jawaban",
  },
  complete: {
    frames: [
      { avatar: "Asset%203.svg", decor: "Asset%2023.svg" },
      { avatar: "Asset%204.svg", decor: "Asset%2024.svg" },
    ],
    interval: 4200,
    label: "jawaban selesai",
  },
  alert: {
    frames: [
      { avatar: "Asset%2011.svg", decor: "Asset%2023.svg" },
      { avatar: "Asset%2012.svg", decor: "Asset%2024.svg" },
    ],
    interval: 3000,
    label: "perlu perhatian",
  },
};

function stateConfig(state) {
  return stateAssets[state] || stateAssets.idle;
}

function AvatarPair({ state, frame = 0, phase }) {
  const config = stateConfig(state);
  const assets = config.frames[frame % config.frames.length];
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
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (state === visibleState) return undefined;
    setLeavingState(visibleState);
    setFrameIndex(0);
    const timer = window.setTimeout(() => {
      setVisibleState(state);
      setLeavingState(null);
    }, 190);
    return () => window.clearTimeout(timer);
  }, [state, visibleState]);

  useEffect(() => {
    if (state !== visibleState) return undefined;
    const config = stateConfig(visibleState);
    if (config.frames.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % config.frames.length);
    }, config.interval);
    return () => window.clearInterval(timer);
  }, [state, visibleState]);

  const assets = stateConfig(visibleState);
  return (
    <span
      className={`aapm-ai-presence ${sizes[size] || sizes.sm} ${className}`}
      data-state={visibleState}
      aria-label={decorative ? undefined : `APPI sedang ${assets.label}`}
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
          key={`enter-${visibleState}-${frameIndex}`}
          state={visibleState}
          frame={frameIndex}
          phase="enter"
        />
      )}
    </span>
  );
}
