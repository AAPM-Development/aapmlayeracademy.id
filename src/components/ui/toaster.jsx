import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import AapmIcon from "@/components/icons/AapmIcon";

const toastMeta = {
  default: { label: "Berhasil", icon: "check" },
  success: { label: "Berhasil", icon: "check" },
  destructive: { label: "Gagal", icon: "alertCircle" },
  warning: { label: "Perlu perhatian", icon: "alert" },
  info: { label: "Informasi", icon: "info" },
  ai: { label: "APPI", icon: "ai" },
  loading: { label: "Memproses", icon: "loading" },
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, variant = "success", duration = 5200, statusLabel, icon, role, ...props }) {
        const meta = toastMeta[variant] || toastMeta.default;
        return (
          <Toast key={id} variant={variant} duration={duration} role={role || (variant === "destructive" ? "alert" : "status")} {...props}>
            <span className="aapm-toast__accent" aria-hidden="true" />
            <span className="aapm-toast__icon" aria-hidden="true">
              <AapmIcon name={icon || meta.icon} className={variant === "loading" ? "h-4.5 w-4.5 animate-spin" : "h-4.5 w-4.5"} />
            </span>
            <div className="aapm-toast__body min-w-0">
              <div className="aapm-toast__eyebrow">{statusLabel || meta.label}</div>
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
              {action && <div className="mt-3">{action}</div>}
            </div>
            <ToastClose />
            <span
              className="aapm-toast__progress"
              style={{ "--toast-duration": `${duration}ms` }}
              aria-hidden="true"
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
