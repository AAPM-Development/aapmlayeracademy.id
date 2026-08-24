import React from "react";
import { Menu, Moon, PanelLeft, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavigationMeta } from "./academyNavigation";
import { cn } from "@/lib/utils";

export default function AcademyHeader({
  onOpenMobile = () => {},
  onToggleSidebar = () => {},
  sidebarCollapsed = false,
  themeMode = "light",
  onToggleTheme = () => {},
  onLogout = () => {},
  user = null,
} = {}) {
  const location = useLocation();
  const page = getNavigationMeta(location.pathname);
  const displayName = user?.full_name || user?.email || "Peserta";

  return (
    <header className="sticky top-0 z-30 flex h-[73px] shrink-0 items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-label="Buka navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
          aria-label={sidebarCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
        >
          <PanelLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
        </button>
        <div className="min-w-0">
          <div className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">{page.group}</div>
          <div className="truncate text-sm font-semibold text-foreground sm:text-base">{page.label}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Badge variant="soft" className="hidden gap-2 bg-surface-subtle text-xs font-medium text-muted-foreground lg:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
          Academy workspace
        </Badge>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleTheme} aria-label={themeMode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}>
          {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="h-9 gap-2 px-2 sm:px-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-green/10 text-xs font-semibold text-brand-green">{displayName.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-[140px] truncate text-xs font-medium sm:inline">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">Layer Farm learner</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>Keluar dari Academy</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
