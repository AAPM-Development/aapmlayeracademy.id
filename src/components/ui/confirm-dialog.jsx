import AapmIcon from "@/components/icons/AapmIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  icon = "solar:info-circle-bold-duotone",
  destructive = false,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="aapm-token-popover p-5 sm:max-w-md">
        <AlertDialogHeader className="text-left">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "aapm-token-icon flex h-10 w-10 shrink-0 items-center justify-center",
                destructive
                  ? "bg-danger/10 text-danger"
                  : "bg-tint-orange text-brand-orange",
              )}
              aria-hidden="true"
            >
              <AapmIcon name={icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <AlertDialogTitle className="text-base leading-6">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-sm leading-5">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-1 gap-2 sm:space-x-0">
          <AlertDialogCancel className="mt-0 h-10 border-border px-4">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              "h-10 px-4",
              destructive &&
                "bg-danger text-destructive-foreground hover:bg-danger/90",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
