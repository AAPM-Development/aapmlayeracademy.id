// @ts-nocheck
// This is a legacy-call-shape adapter over Ten4Seven's typed toast hook.
// Its input is intentionally open-ended so existing product calls can retain
// their business payload while the canonical provider owns presentation.
import { useRef } from "react";
import { useToast as useCanonicalToast } from "@ten4seven/ui";

const toneByLegacyVariant = {
  default: "success",
  success: "success",
  destructive: "danger",
  warning: "warning",
  info: "info",
  ai: "info",
  loading: "neutral",
};

const DEFAULT_TOAST_DURATION = 5200;
const STACKED_TOAST_STAGGER = 720;

function normalizeDuration(value, staggerIndex = 0) {
  const requestedDuration = Number(value);

  return Number.isFinite(requestedDuration)
    ? Math.min(12000, Math.max(2400, requestedDuration))
    : Math.min(
        12000,
        DEFAULT_TOAST_DURATION +
          Math.min(3, Math.max(0, Number(staggerIndex) || 0)) *
            STACKED_TOAST_STAGGER,
      );
}

function toCanonicalToastInput({
  action,
  duration,
  title,
  tone,
  variant,
  ...input
} = {}, { staggerIndex = 0 } = {}) {
  const canonicalAction =
    action &&
    typeof action === "object" &&
    typeof action.label !== "undefined" &&
    typeof action.onAction === "function"
      ? action
      : undefined;

  return {
    ...input,
    action: canonicalAction,
    // Give each newly-created item its own deadline. A burst of feedback no
    // longer creates one shared expiry moment for the whole stack; explicit
    // durations remain authoritative for callers that need them.
    duration: normalizeDuration(duration, staggerIndex),
    title: title || "Informasi",
    tone: tone || toneByLegacyVariant[variant] || "success",
  };
}

/*
 * Preserve the product-level toast call shape (`variant`, bounded duration,
 * returned dismiss/update helpers) while feedback ownership lives entirely in
 * the Ten4Seven provider. This prevents a second Radix viewport from drifting
 * from canonical overlay tokens.
 */
function useToast() {
  const { dismiss, toast: emitToast, toasts } = useCanonicalToast();
  const toastSequence = useRef(0);

  const toast = (input = {}) => {
    const staggerIndex = Math.max(
      toasts.length,
      toastSequence.current % 4,
    );
    toastSequence.current += 1;
    const id = emitToast(
      toCanonicalToastInput(input, { staggerIndex }),
    );

    return {
      id,
      dismiss: () => dismiss(id),
      update: (nextInput = {}) =>
        emitToast(
          toCanonicalToastInput({
            ...input,
            ...nextInput,
            id,
          }),
        ),
    };
  };

  return { dismiss, toast, toasts };
}

export { useToast };
