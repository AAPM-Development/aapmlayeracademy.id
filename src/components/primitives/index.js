// @ts-nocheck
import React from "react";
import { cn } from "@/lib/utils";

import {
  BarChart as T7BarChartPrimitive,
  ChartPanel as T7ChartPanelPrimitive,
  CircularProgress as T7CircularProgressPrimitive,
  DataTable as T7DataTablePrimitive,
  DataTableColumnPicker as T7DataTableColumnPicker,
  FilterToolbar as T7FilterToolbar,
  FormGrid as T7FormGrid,
  FormSection as T7FormSection,
  KPICluster as T7KPIClusterPrimitive,
  LineChart as T7LineChartPrimitive,
  MetricCard as T7MetricCard,
  Sparkline as T7SparklinePrimitive,
  SectionHeader as T7SectionHeaderPrimitive,
  TrendIndicator as T7TrendIndicator,
} from "@ten4seven/ui";

// AAPM's product-facing primitive facade.
// Vendor/Radix details stay behind this boundary so feature code has one import surface.

export { Button, buttonVariants } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
export { PasswordInput } from "@/components/ui/password-input";
export { Textarea } from "@/components/ui/textarea";
export { Label } from "@/components/ui/label";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton } from "@/components/ui/select";
export { Checkbox } from "@/components/ui/checkbox";
export { Switch } from "@/components/ui/switch";
export { Badge, badgeVariants } from "@/components/ui/badge";
export { Progress } from "@/components/ui/progress";
export { Skeleton } from "@/components/ui/skeleton";
export { IconTile, iconTileVariants } from "@/components/ui/icon-tile";
export { IconButton } from "@/components/ui/icon-button";
export { Surface, surfaceVariants } from "@/components/primitives/surface";
export { default as Icon, aapmIconNames, aapmIconSources } from "@/components/icons/AapmIcon";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
export { default as ConfirmDialog } from "@/components/ui/confirm-dialog";
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "@/components/ui/sheet";
export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator } from "@/components/ui/command";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
export { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup } from "@/components/ui/context-menu";
export { Menubar, MenubarMenu, MenubarGroup, MenubarPortal, MenubarRadioGroup, MenubarSub, MenubarTrigger, MenubarSubTrigger, MenubarSubContent, MenubarContent, MenubarItem, MenubarCheckboxItem, MenubarRadioItem, MenubarLabel, MenubarSeparator, MenubarShortcut } from "@/components/ui/menubar";
export { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
export { Toggle, toggleVariants } from "@/components/ui/toggle";
export { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
export { Slider } from "@/components/ui/slider";
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
export { Calendar } from "@/components/ui/calendar";
// Data-dense views use the canonical Ten4Seven contracts directly. The small
// adapters below are intentionally boring: they only attach Academy's
// semantic bridge hooks and safe defaults, so a table/KPI/chart cannot drift
// into a second local visual system as it moves between learner and admin.
export const T7BarChart = T7BarChartPrimitive;
export const DataTableColumnPicker = T7DataTableColumnPicker;
export const FilterToolbar = T7FilterToolbar;
export const FormGrid = T7FormGrid;
export const FormSection = T7FormSection;
export const MetricCard = T7MetricCard;
export const TrendIndicator = T7TrendIndicator;

/**
 * SectionHeader keeps lesson and admin surfaces on the same Ten4Seven
 * heading grammar while still giving feature code one Academy import path.
 */
/** @type {any} */
export const SectionHeader = ({ className, ...props } = {}) => {
  return React.createElement(T7SectionHeaderPrimitive, {
    ...props,
    className: cn("aapm-section-header", className),
    "data-t7-bridge": "academy-section-header",
  });
};

/** @type {any} */
export const DataTable = ({ className, density = "default", responsive = "scroll", ...props } = {}) => {
  return React.createElement(T7DataTablePrimitive, {
    ...props,
    density,
    responsive,
    className: cn("aapm-data-table", className),
    "data-t7-bridge": "academy-data-table",
  });
};

/** @type {any} */
export const ChartPanel = ({ className, ...props } = {}) => {
  return React.createElement(T7ChartPanelPrimitive, { ...props, className: cn("aapm-chart-panel", className), "data-t7-bridge": "academy-chart-panel" });
};

/** @type {any} */
export const T7LineChart = ({ className, ...props } = {}) => {
  return React.createElement(T7LineChartPrimitive, { ...props, className: cn("aapm-line-chart", className), "data-t7-bridge": "academy-line-chart" });
};

/** @type {any} */
export const KPICluster = ({ className, ...props } = {}) => {
  return React.createElement(T7KPIClusterPrimitive, { ...props, className: cn("aapm-kpi-cluster", className), "data-t7-bridge": "academy-kpi-cluster" });
};

/** @type {any} */
export const Sparkline = ({ className, ...props } = {}) => {
  return React.createElement(T7SparklinePrimitive, { ...props, className: cn("aapm-sparkline", className), "data-t7-bridge": "academy-sparkline" });
};
/** @type {any} */
export const CircularProgress = ({ className, ...props } = {}) => {
  return React.createElement(T7CircularProgressPrimitive, { ...props, className: cn("aapm-circular-progress", className), "data-t7-bridge": "academy-circular-progress" });
};
export { useToast } from "@/components/ui/use-toast";
