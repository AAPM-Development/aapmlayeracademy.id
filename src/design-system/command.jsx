import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

// cmdk-backed command list, imported only by routes that need search menus.

/* --------------------------------------------------------------- Command */
const Command = React.forwardRef(function Command({ className, ...props }, ref) {
  return <CommandPrimitive ref={ref} className={cn("aapm-command", className)} {...props} />;
});
const CommandInput = React.forwardRef(function CommandInput({ className, ...props }, ref) {
  return (
    <div className="aapm-command__input">
      <AapmIcon name="search" />
      <CommandPrimitive.Input ref={ref} className={className} {...props} />
    </div>
  );
});
const CommandList = React.forwardRef(function CommandList({ className, ...props }, ref) {
  return <CommandPrimitive.List ref={ref} className={cn("aapm-command__list", className)} {...props} />;
});
const CommandEmpty = React.forwardRef(function CommandEmpty({ className, ...props }, ref) {
  return <CommandPrimitive.Empty ref={ref} className={cn("aapm-command__empty", className)} {...props} />;
});
const CommandGroup = React.forwardRef(function CommandGroup({ className, ...props }, ref) {
  return <CommandPrimitive.Group ref={ref} className={cn("aapm-command__group", className)} {...props} />;
});
const CommandItem = React.forwardRef(function CommandItem({ className, ...props }, ref) {
  return <CommandPrimitive.Item ref={ref} className={cn("aapm-menu-item", className)} {...props} />;
});
const CommandSeparator = React.forwardRef(function CommandSeparator({ className, ...props }, ref) {
  return <CommandPrimitive.Separator ref={ref} className={cn("aapm-menu-separator", className)} {...props} />;
});
const CommandShortcut = ({ className, ...props }) => <span className={cn("aapm-menu-shortcut", className)} {...props} />;

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
