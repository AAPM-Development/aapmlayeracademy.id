import React, { useEffect, useRef, useState } from "react";

const STATE_EXIT_MS = 260;
const STATE_ENTER_MS = 380;
const FRAME_EXIT_MS = 180;
const FRAME_ENTER_MS = 320;

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
  const visibleStateRef = useRef(state);
  const [stateTransition, setStateTransition] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [frameTransition, setFrameTransition] = useState(null);
  const frameIndexRef = useRef(0);
  const stateExitTimerRef = useRef(null);
  const stateEnterTimerRef = useRef(null);
  const frameExitTimerRef = useRef(null);
  const frameEnterTimerRef = useRef(null);

  useEffect(() => {
    if (state === visibleStateRef.current) {
      window.clearTimeout(stateExitTimerRef.current);
      window.clearTimeout(stateEnterTimerRef.current);
      setStateTransition(null);
      return undefined;
    }

    const from = visibleStateRef.current;
    window.clearTimeout(stateExitTimerRef.current);
    window.clearTimeout(stateEnterTimerRef.current);
    window.clearTimeout(frameExitTimerRef.current);
    window.clearTimeout(frameEnterTimerRef.current);
    setStateTransition({ phase: "exit", from, to: state });
    setFrameTransition(null);

    stateExitTimerRef.current = window.setTimeout(() => {
      visibleStateRef.current = state;
      frameIndexRef.current = 0;
      setVisibleState(state);
      setFrameIndex(0);
      setStateTransition({ phase: "enter", from: null, to: state });
      stateEnterTimerRef.current = window.setTimeout(
        () => setStateTransition(null),
        STATE_ENTER_MS,
      );
    }, STATE_EXIT_MS);

    return () => {
      window.clearTimeout(stateExitTimerRef.current);
      window.clearTimeout(stateEnterTimerRef.current);
    };
  }, [state]);

  useEffect(() => {
    if (state !== visibleState || stateTransition) return undefined;
    const config = stateConfig(visibleState);
    if (config.frames.length < 2) return undefined;

    const timer = window.setInterval(() => {
      const from = frameIndexRef.current;
      const to = (from + 1) % config.frames.length;
      frameIndexRef.current = to;

      window.clearTimeout(frameExitTimerRef.current);
      window.clearTimeout(frameEnterTimerRef.current);
      setFrameTransition({ phase: "exit", from, to });
      frameExitTimerRef.current = window.setTimeout(() => {
        setFrameIndex(to);
        setFrameTransition({ phase: "enter", from, to });
        frameEnterTimerRef.current = window.setTimeout(
          () => setFrameTransition(null),
          FRAME_ENTER_MS,
        );
      }, FRAME_EXIT_MS);
    }, config.interval);
    return () => window.clearInterval(timer);
  }, [state, stateTransition, visibleState]);

  useEffect(
    () => () => {
      window.clearTimeout(stateExitTimerRef.current);
      window.clearTimeout(stateEnterTimerRef.current);
      window.clearTimeout(frameExitTimerRef.current);
      window.clearTimeout(frameEnterTimerRef.current);
    },
    [],
  );

  const assets = stateConfig(visibleState);
  const isStateTransitioning = Boolean(stateTransition);
  const isFrameTransitioning = !isStateTransitioning && Boolean(frameTransition);
  const shownState =
    stateTransition?.phase === "exit" ? stateTransition.from : visibleState;
  const shownFrame = isStateTransitioning
    ? 0
    : frameTransition?.phase === "exit"
      ? frameTransition.from
      : frameTransition?.to ?? frameIndex;
  const shownPhase = isStateTransitioning
    ? stateTransition.phase
    : isFrameTransitioning
      ? `frame-${frameTransition.phase}`
      : "active";
  return (
    <span
      className={`aapm-ai-presence ${sizes[size] || sizes.sm} ${className}`}
      data-state={visibleState}
      aria-label={decorative ? undefined : `APPI sedang ${assets.label}`}
      aria-hidden={decorative || undefined}
    >
      <AvatarPair
        key={`${shownPhase}-${shownState}-${shownFrame}`}
        state={shownState}
        frame={shownFrame}
        phase={shownPhase}
      />
    </span>
  );
}
