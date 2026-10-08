import * as React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, IconButton } from "./actions";

const ToastContext = React.createContext(null);

const toneByLegacyVariant = {
  default: "success",
  success: "success",
  destructive: "danger",
  danger: "danger",
  warning: "warning",
  info: "info",
  ai: "info",
  loading: "neutral",
  neutral: "neutral",
};

const iconByTone = { success: "check", danger: "danger", warning: "warning", info: "info", neutral: "info" };
const DEFAULT_DURATION = 5200;
const MAX_VISIBLE = 4;

function normalizeDuration(value) {
  const requested = Number(value);
  if (value === Infinity) return Infinity;
  return Number.isFinite(requested) ? Math.min(12000, Math.max(2400, requested)) : DEFAULT_DURATION;
}

let sequence = 0;

/** One feedback region for the whole Academy. */
function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const timers = React.useRef(new Map());

  const remove = React.useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismiss = React.useCallback((id) => {
    if (!id) {
      setToasts((current) => current.map((item) => ({ ...item, leaving: true })));
      window.setTimeout(() => setToasts([]), 160);
      return;
    }
    setToasts((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    window.setTimeout(() => remove(id), 160);
  }, [remove]);

  const schedule = React.useCallback((id, duration) => {
    const previous = timers.current.get(id);
    if (previous) window.clearTimeout(previous);
    if (duration === Infinity) return;
    timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  const emit = React.useCallback((input = {}) => {
    const id = input.id || `toast-${Date.now()}-${(sequence += 1)}`;
    const item = {
      id,
      title: input.title || "Informasi",
      description: input.description,
      tone: input.tone || toneByLegacyVariant[input.variant] || "success",
      action: input.action && typeof input.action.onAction === "function" ? input.action : undefined,
      duration: normalizeDuration(input.duration),
    };
    setToasts((current) => {
      const exists = current.some((entry) => entry.id === id);
      const next = exists ? current.map((entry) => (entry.id === id ? item : entry)) : [...current, item];
      return next.slice(-MAX_VISIBLE);
    });
    schedule(id, item.duration);
    return id;
  }, [schedule]);

  React.useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const value = React.useMemo(() => ({ toasts, emit, dismiss }), [toasts, emit, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="aapm-toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((item) => (
          <div key={item.id} className="aapm-toast" data-tone={item.tone} data-leaving={item.leaving ? "true" : undefined} role={item.tone === "danger" ? "alert" : "status"}>
            <AapmIcon name={iconByTone[item.tone] || "info"} />
            <div className="min-w-0">
              <p className="aapm-toast__title">{item.title}</p>
              {item.description ? <p className="aapm-toast__description">{item.description}</p> : null}
              {item.action ? (
                <Button
                  size="sm"
                  variant="link"
                  className="aapm-toast__action"
                  onClick={() => {
                    item.action.onAction();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </Button>
              ) : null}
            </div>
            <IconButton label="Tutup notifikasi" tooltip={null} icon="close" size="sm" onClick={() => dismiss(item.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Product toast call shape: toast({ title, description, variant, duration,
 * action }) → { id, dismiss, update }.
 */
function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside the AAPM ToastProvider");
  const { emit, dismiss, toasts } = context;

  const toast = React.useCallback((input = {}) => {
    const id = emit(input);
    return {
      id,
      dismiss: () => dismiss(id),
      update: (next = {}) => emit({ ...input, ...next, id }),
    };
  }, [emit, dismiss]);

  return { toast, dismiss, toasts };
}

export { ToastProvider, useToast };
