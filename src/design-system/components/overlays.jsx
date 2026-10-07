import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./actions";

/* ---------------------------------------------------------------- Dialog */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return <DialogPrimitive.Overlay ref={ref} className={cn("aapm-overlay", className)} {...props} />;
});

/**
 * Modal dialog. `size` sm | md | lg | xl. On phones dialogs become bottom
 * sheets unless `mobile="center"`. Long forms should use DialogBody so the
 * header and footer stay visible while the body scrolls.
 */
const DialogContent = React.forwardRef(function DialogContent(
  { className, children, size = "md", hideClose = false, closeLabel = "Tutup", mobile, layout, ...props },
  ref,
) {
  const childArray = React.Children.toArray(children);
  const usesSlots = layout === "slots" || childArray.some((child) => React.isValidElement(child) && child.type === DialogBody);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("aapm-dialog", className)}
        data-size={size}
        data-mobile={mobile}
        data-layout={usesSlots ? "slots" : "plain"}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close asChild>
            <IconButton className="aapm-dialog__close" label={closeLabel} tooltip={null} icon="close" size="sm" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

const DialogHeader = ({ className, ...props }) => <div className={cn("aapm-dialog__header", className)} {...props} />;
const DialogBody = ({ className, ...props }) => <div className={cn("aapm-dialog__body", className)} {...props} />;
const DialogFooter = ({ className, ...props }) => <div className={cn("aapm-dialog__footer", className)} {...props} />;

const DialogTitle = React.forwardRef(function DialogTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cn("aapm-dialog__title", className)} {...props} />;
});

const DialogDescription = React.forwardRef(function DialogDescription({ className, ...props }, ref) {
  return <DialogPrimitive.Description ref={ref} className={cn("aapm-dialog__description", className)} {...props} />;
});

/* ----------------------------------------------------------------- Sheet */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;
const SheetOverlay = DialogOverlay;

const SheetContent = React.forwardRef(function SheetContent(
  { side = "right", className, children, hideClose = false, closeLabel = "Tutup", ...props },
  ref,
) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content ref={ref} className={cn("aapm-sheet", className)} data-side={side} {...props}>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close asChild>
            <IconButton className="aapm-sheet__close" label={closeLabel} tooltip={null} icon="close" size="sm" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});

const SheetHeader = ({ className, ...props }) => <div className={cn("aapm-dialog__header !p-0 !pe-10", className)} {...props} />;
const SheetFooter = ({ className, ...props }) => <div className={cn("aapm-form-actions mt-auto", className)} {...props} />;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;

/* ----------------------------------------------------------- AlertDialog */
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef(function AlertDialogOverlay({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Overlay ref={ref} className={cn("aapm-overlay", className)} {...props} />;
});

const AlertDialogContent = React.forwardRef(function AlertDialogContent({ className, size = "sm", ...props }, ref) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn("aapm-dialog", className)}
        data-size={size}
        data-layout="plain"
        data-mobile="center"
        {...props}
      />
    </AlertDialogPortal>
  );
});

const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = React.forwardRef(function AlertDialogTitle({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Title ref={ref} className={cn("aapm-dialog__title", className)} {...props} />;
});
const AlertDialogDescription = React.forwardRef(function AlertDialogDescription({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Description ref={ref} className={cn("aapm-dialog__description", className)} {...props} />;
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
 * Confirmation for consequential actions. Destructive confirmations use the
 * danger action and a danger icon; the cancel action always stays first.
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
  children,
}) {
  const resolvedIcon = icon || (destructive ? "danger" : "info");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="flex items-start gap-3">
          <span className="aapm-icon-tile" data-hue={destructive ? "rose" : "orange"} aria-hidden="true">
            <AapmIcon name={resolvedIcon} />
          </span>
          <div className="min-w-0 pt-0.5">
            <AlertDialogTitle data-size="sm">{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription className="mt-1">{description}</AlertDialogDescription> : null}
          </div>
        </div>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
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
      <DropdownPrimitive.Content ref={ref} sideOffset={sideOffset} align={align} className={cn("aapm-menu", className)} {...props} />
    </DropdownPrimitive.Portal>
  );
});

const DropdownMenuItem = React.forwardRef(function DropdownMenuItem({ className, inset, tone, icon, children, ...props }, ref) {
  return (
    <DropdownPrimitive.Item ref={ref} className={cn("aapm-menu-item", className)} data-inset={inset ? "true" : undefined} data-tone={tone} {...props}>
      {icon ? <AapmIcon name={icon} /> : null}
      {children}
    </DropdownPrimitive.Item>
  );
});

const DropdownMenuCheckboxItem = React.forwardRef(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.CheckboxItem ref={ref} className={cn("aapm-menu-item", className)} data-select="true" {...props}>
      <span className="aapm-menu-item__indicator">
        <DropdownPrimitive.ItemIndicator><AapmIcon name="glyphCheck" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
});

const DropdownMenuRadioItem = React.forwardRef(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.RadioItem ref={ref} className={cn("aapm-menu-item", className)} data-select="true" {...props}>
      <span className="aapm-menu-item__indicator">
        <DropdownPrimitive.ItemIndicator><span className="aapm-radio__dot" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  );
});

const DropdownMenuLabel = React.forwardRef(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return <DropdownPrimitive.Label ref={ref} className={cn("aapm-menu-label", inset && "ps-8", className)} {...props} />;
});

const DropdownMenuSeparator = React.forwardRef(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownPrimitive.Separator ref={ref} className={cn("aapm-menu-separator", className)} {...props} />;
});

const DropdownMenuShortcut = ({ className, ...props }) => <span className={cn("aapm-menu-shortcut", className)} {...props} />;

const DropdownMenuSubTrigger = React.forwardRef(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.SubTrigger ref={ref} className={cn("aapm-menu-item", className)} {...props}>
      {children}
      <AapmIcon name="chevronRight" className="ms-auto" />
    </DropdownPrimitive.SubTrigger>
  );
});

const DropdownMenuSubContent = React.forwardRef(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent ref={ref} className={cn("aapm-menu", className)} {...props} />
    </DropdownPrimitive.Portal>
  );
});

/**
 * Overflow (kebab) menu for contextual, low-frequency actions. Items:
 * { id, label, icon?, tone?: "danger", disabled?, onSelect }. Destructive
 * items are separated from the rest automatically.
 */
function OverflowMenu({ label = "Aksi lainnya", items = [], align = "end", triggerVariant = "ghost", size = "sm", className }) {
  const safe = items.filter(Boolean);
  const regular = safe.filter((item) => item.tone !== "danger");
  const destructive = safe.filter((item) => item.tone === "danger");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={label} tooltip={null} icon="more" variant={triggerVariant} size={size} className={className} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[12rem]">
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
      <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} className={cn("aapm-popover", className)} {...props} />
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
