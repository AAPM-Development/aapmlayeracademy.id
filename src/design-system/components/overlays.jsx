import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn, hasFinePointer } from "@/lib/utils";
import { Ic } from "../canvas";
import { Button } from "./actions";

// Canvas overlays (academy.css §12): scrim → dialog → menu on one z ladder.
// The canvas draws them inside a board; academy-app.css fixes them to the
// viewport and adds the open/close motion.

/**
 * Radix returns focus only to its own Trigger, and most overlays here open from app state,
 * so without this focus falls to the page body on close. Keeps whatever had focus at open.
 * On touch the panel itself takes focus, so opening it does not raise the keyboard.
 */
function useFocusReturn({ onOpenAutoFocus, onCloseAutoFocus }) {
  const opener = React.useRef(null);
  return {
    onOpenAutoFocus: (event) => {
      opener.current = document.activeElement;
      onOpenAutoFocus?.(event);
      if (event.defaultPrevented || hasFinePointer()) return;
      event.preventDefault();
      event.target.focus({ preventScroll: true });
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      if (event.defaultPrevented || !target?.isConnected || target === document.body) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}

function CloseButton({ label, className }) {
  return (
    <DialogPrimitive.Close asChild>
      <button type="button" className={cn("btn btn-ghost btn-quiet btn-sm btn-icon", className)} aria-label={label}>
        <Ic name="x" />
      </button>
    </DialogPrimitive.Close>
  );
}

/* ---------------------------------------------------------------- Dialog */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return <DialogPrimitive.Overlay ref={ref} className={cn("scrim scrim-live", className)} {...props} />;
});

/**
 * Modal dialog (`.dialog`). `size` sm | md | lg | xl. On phones dialogs
 * become bottom sheets unless `mobile="center"`. The content scrolls inside
 * `.dialog-scroll`, so the close button, header, and footer stay in view.
 */
const DialogContent = React.forwardRef(function DialogContent(
  { className, children, size = "md", hideClose = false, closeLabel = "Tutup", mobile, layout, ...props },
  ref,
) {
  const focusReturn = useFocusReturn(props);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("dialog dialog-live", className)}
        data-size={size}
        data-mobile={mobile}
        data-layout={layout}
        {...props}
        {...focusReturn}
      >
        <div className="dialog-scroll">{children}</div>
        {!hideClose && <CloseButton label={closeLabel} className="dialog-close" />}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

const DialogHeader = ({ className, ...props }) => <div className={cn("stack gap-1 dialog-head", className)} {...props} />;
const DialogBody = ({ className, ...props }) => <div className={cn("dialog-body", className)} {...props} />;
const DialogFooter = ({ className, ...props }) => <div className={cn("dialog-foot", className)} {...props} />;

const DialogTitle = React.forwardRef(function DialogTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cn("t-section", className)} {...props} />;
});

const DialogDescription = React.forwardRef(function DialogDescription({ className, ...props }, ref) {
  return <DialogPrimitive.Description ref={ref} className={cn("t-body t-muted", className)} {...props} />;
});

/* ----------------------------------------------------------------- Sheet */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;
const SheetOverlay = DialogOverlay;

/** Side panel (`.sheet`, max 480) on desktop, full-width bottom sheet on phones. */
const SheetContent = React.forwardRef(function SheetContent(
  { side = "right", className, children, hideClose = false, closeLabel = "Tutup", ...props },
  ref,
) {
  const focusReturn = useFocusReturn(props);
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content ref={ref} className={cn("sheet sheet-live", className)} data-side={side} {...props} {...focusReturn}>
        {children}
        {!hideClose && <CloseButton label={closeLabel} className="sheet-close" />}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});

const SheetHeader = ({ className, ...props }) => <div className={cn("sheet-head sheet-head-stack", className)} {...props} />;
const SheetBody = ({ className, ...props }) => <div className={cn("sheet-body", className)} {...props} />;
const SheetFooter = ({ className, ...props }) => <div className={cn("sheet-foot", className)} {...props} />;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;

/* ----------------------------------------------------------- AlertDialog */
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef(function AlertDialogOverlay({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Overlay ref={ref} className={cn("scrim scrim-live", className)} {...props} />;
});

const AlertDialogContent = React.forwardRef(function AlertDialogContent({ className, size = "sm", children, ...props }, ref) {
  const focusReturn = useFocusReturn(props);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn("dialog dialog-live", className)}
        data-size={size}
        data-mobile="center"
        {...props}
        {...focusReturn}
      >
        <div className="dialog-scroll">{children}</div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});

const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = React.forwardRef(function AlertDialogTitle({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Title ref={ref} className={cn("t-section", className)} {...props} />;
});
const AlertDialogDescription = React.forwardRef(function AlertDialogDescription({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Description ref={ref} className={cn("t-body t-muted", className)} {...props} />;
});
const AlertDialogAction = React.forwardRef(function AlertDialogAction({ variant = "primary", className, children, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button ref={ref} variant={variant} className={className} {...props}>{children}</Button>
    </AlertDialogPrimitive.Action>
  );
});
const AlertDialogCancel = React.forwardRef(function AlertDialogCancel({ variant = "secondary", className, children, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button ref={ref} variant={variant} className={className} {...props}>{children}</Button>
    </AlertDialogPrimitive.Cancel>
  );
});

/**
 * Confirmation for consequential actions (canvas dialog anatomy): a round
 * tile, title and consequence, then Batal first and the action on the right.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  icon,
  destructive = false,
  loading = false,
  onConfirm,
  children = null,
}) {
  const resolvedIcon = icon || (destructive ? "delete" : "info");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="row-start gap-3">
          <span className="tile tile-round" data-hue={destructive ? "rose" : "ai"} aria-hidden="true">
            <AapmIcon name={resolvedIcon} />
          </span>
          <div className="stack gap-1" style={{ minWidth: 0 }}>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          </div>
        </div>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {destructive ? <AapmIcon name={resolvedIcon} /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------------------------------------------------------- DropdownMenu */
const DropdownMenu = DropdownPrimitive.Root;
const DropdownMenuTrigger = DropdownPrimitive.Trigger;
const DropdownMenuGroup = DropdownPrimitive.Group;
const DropdownMenuPortal = DropdownPrimitive.Portal;
const DropdownMenuSub = DropdownPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

const DropdownMenuContent = React.forwardRef(function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content ref={ref} sideOffset={sideOffset} align={align} className={cn("menu menu-pop", className)} {...props} />
    </DropdownPrimitive.Portal>
  );
});

const DropdownMenuItem = React.forwardRef(function DropdownMenuItem({ className, inset, tone, icon, asChild, children, ...props }, ref) {
  return (
    <DropdownPrimitive.Item ref={ref} asChild={asChild} className={cn("menu-item", tone === "danger" && "is-danger", inset && "menu-inset", className)} {...props}>
      {asChild ? children : <>{icon ? <AapmIcon name={icon} /> : null}{children}</>}
    </DropdownPrimitive.Item>
  );
});

const DropdownMenuCheckboxItem = React.forwardRef(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.CheckboxItem ref={ref} className={cn("menu-item", className)} {...props}>
      <span className="menu-check">
        <DropdownPrimitive.ItemIndicator><Ic name="check" size="sm" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
});

const DropdownMenuRadioItem = React.forwardRef(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.RadioItem ref={ref} className={cn("menu-item", className)} {...props}>
      <span className="menu-check">
        <DropdownPrimitive.ItemIndicator><span className="radio-dot" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  );
});

const DropdownMenuLabel = React.forwardRef(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return <DropdownPrimitive.Label ref={ref} className={cn("menu-label", inset && "menu-inset", className)} {...props} />;
});

const DropdownMenuSeparator = React.forwardRef(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownPrimitive.Separator ref={ref} className={cn("menu-sep", className)} {...props} />;
});

const DropdownMenuShortcut = ({ className, ...props }) => <span className={cn("kbd ml-auto", className)} {...props} />;

const DropdownMenuSubTrigger = React.forwardRef(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.SubTrigger ref={ref} className={cn("menu-item", className)} {...props}>
      {children}
      <Ic name="chev-right" size="sm" className="ml-auto" />
    </DropdownPrimitive.SubTrigger>
  );
});

const DropdownMenuSubContent = React.forwardRef(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent ref={ref} className={cn("menu menu-pop", className)} {...props} />
    </DropdownPrimitive.Portal>
  );
});

/**
 * Overflow (kebab) menu for contextual, low-frequency actions. Items:
 * { id, label, icon?, tone?: "danger", disabled?, onSelect }. Destructive
 * items come last, after a separator.
 */
function OverflowMenu({ label = "Aksi lainnya", items = [], align = "end", triggerVariant = "ghost", size = "sm", className }) {
  const safe = items.filter(Boolean);
  const regular = safe.filter((item) => item.tone !== "danger");
  const destructive = safe.filter((item) => item.tone === "danger");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn("btn btn-icon", triggerVariant === "secondary" ? "btn-secondary" : "btn-ghost", size === "sm" && "btn-sm", className)} aria-label={label}>
          <Ic name="more" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {regular.map((item) => (
          <DropdownMenuItem key={item.id || item.label} icon={item.icon} disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>
        ))}
        {regular.length && destructive.length ? <DropdownMenuSeparator /> : null}
        {destructive.map((item) => (
          <DropdownMenuItem key={item.id || item.label} icon={item.icon} tone="danger" disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------- Popover */
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

const PopoverContent = React.forwardRef(function PopoverContent({ className, align = "center", sideOffset = 6, ...props }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} className={cn("card card-raised popover menu-pop", className)} {...props} />
    </PopoverPrimitive.Portal>
  );
});

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  OverflowMenu,
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
};
