// @ts-nocheck
// This is a legacy-call-shape adapter over Ten4Seven's typed toast hook.
// Its input is intentionally open-ended so existing product calls can retain
// their business payload while the canonical provider owns presentation.
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

function normalizeDuration(value) {
  const requestedDuration = Number(value);

  return Number.isFinite(requestedDuration)
    ? Math.min(12000, Math.max(2400, requestedDuration))
    : DEFAULT_TOAST_DURATION;
}

function toCanonicalToastInput({
  action,
  duration,
  title,
  tone,
  variant,
  ...input
} = {}) {
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
    duration: normalizeDuration(duration),
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

  const toast = (input = {}) => {
    const id = emitToast(toCanonicalToastInput(input));

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
