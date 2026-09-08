// AAPM's product-facing primitive facade.
// Vendor/Radix details stay behind this boundary so feature code has one import surface.

export { Button, buttonVariants } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
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
// Data-dense views use the canonical Ten4Seven contracts directly. Keeping
// these behind the product facade prevents feature pages from importing a
// second table/chart/form system by accident.
export {
  BarChart as T7BarChart,
  ChartPanel,
  DataTable,
  DataTableColumnPicker,
  FilterToolbar,
  FormGrid,
  FormSection,
  KPICluster,
  LineChart as T7LineChart,
  MetricCard,
  Sparkline,
  TrendIndicator,
} from "@ten4seven/ui";
export { useToast } from "@/components/ui/use-toast";
