import React, { useEffect, useRef, useState } from "react";

const STATE_TRANSITION_MS = 360;
const FRAME_TRANSITION_MS = 340;

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
    // Idle is a calm companion state: keep one neutral pair on screen and
    // reserve expressive frames for meaningful changes in the conversation.
    frames: [{ avatar: "Asset%201.svg", decor: "Asset%2013.svg" }],
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
      { avatar: "Asset%2010.svg", decor: "Asset%2022.svg" },
      { avatar: "Asset%2012.svg", decor: "Asset%2024.svg" },
    ],
    interval: 1800,
    label: "menyusun jawaban",
  },
  complete: {
    frames: [
      { avatar: "Asset%209.svg", decor: "Asset%2021.svg" },
    ],
    interval: 4200,
    label: "jawaban selesai",
  },
  success: {
    frames: [
      { avatar: "Asset%204.svg", decor: "Asset%2016.svg" },
      { avatar: "Asset%209.svg", decor: "Asset%2021.svg" },
    ],
    interval: 4200,
    label: "berhasil membantu",
  },
  alert: {
    frames: [
      { avatar: "Asset%2011.svg", decor: "Asset%2023.svg" },
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
    <span className={`aapm-ai-presence__pair aapm-ai-presence__pair--${phase}`}>
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
    </span>
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
  const [frameTransition, setFrameTransition] = useState(null);
  const frameIndexRef = useRef(0);

  useEffect(() => {
    if (state === visibleState) return undefined;

    setLeavingState(visibleState);
    setVisibleState(state);
    frameIndexRef.current = 0;
    setFrameIndex(0);
    setFrameTransition(null);
    return undefined;
  }, [state, visibleState]);

  useEffect(() => {
    if (!leavingState) return undefined;
    const timer = window.setTimeout(
      () => setLeavingState(null),
      STATE_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [leavingState]);

  useEffect(() => {
    if (state !== visibleState || leavingState) return undefined;
    const config = stateConfig(visibleState);
    if (config.frames.length < 2) return undefined;

    const timer = window.setInterval(() => {
      const from = frameIndexRef.current;
      const to = (from + 1) % config.frames.length;
      frameIndexRef.current = to;
      setFrameTransition({ from, to });
      setFrameIndex(to);
    }, config.interval);
    return () => window.clearInterval(timer);
  }, [leavingState, state, visibleState]);

  useEffect(() => {
    if (!frameTransition) return undefined;
    const timer = window.setTimeout(
      () => setFrameTransition(null),
      FRAME_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [frameTransition]);

  const assets = stateConfig(visibleState);
  const isStateTransitioning = Boolean(leavingState);
  return (
    <span
      className={`aapm-ai-presence ${sizes[size] || sizes.sm} ${className}`}
      data-state={visibleState}
      aria-label={decorative ? undefined : `APPI sedang ${assets.label}`}
      aria-hidden={decorative || undefined}
    >
      {leavingState && (
        <AvatarPair
          key={`exit-${leavingState}`}
          state={leavingState}
          phase="exit"
        />
      )}
      {!isStateTransitioning && frameTransition && (
        <AvatarPair
          key={`frame-exit-${visibleState}-${frameTransition.from}`}
          state={visibleState}
          frame={frameTransition.from}
          phase="frame-exit"
        />
      )}
      {frameTransition && !isStateTransitioning ? (
        <AvatarPair
          key={`frame-enter-${visibleState}-${frameTransition.to}`}
          state={visibleState}
          frame={frameTransition.to}
          phase="frame-enter"
        />
      ) : (
        <AvatarPair
          key={`${isStateTransitioning ? "state-enter" : "active"}-${visibleState}`}
          state={visibleState}
          frame={frameIndex}
          phase={isStateTransitioning ? "enter" : "active"}
        />
      )}
    </span>
  );
}
