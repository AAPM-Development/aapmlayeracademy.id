import React from "react";
import { useLocation } from "react-router-dom";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, IconButton } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { getNavigationMeta } from "./academyNavigation";

export default function AcademyHeader({
  onOpenMobile = () => {},
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
        <IconButton
          onClick={onOpenMobile}
          className="lg:hidden"
          label="Buka navigasi"
        >
          <AapmIcon name="menu" className="h-5 w-5" />
        </IconButton>
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
        <IconButton variant="ghost" onClick={onToggleTheme} label={themeMode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}>
          <AapmIcon name={themeMode === "dark" ? "themeLight" : "themeDark"} className="h-4 w-4" />
        </IconButton>
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
            <DropdownMenuItem onClick={onLogout}><AapmIcon name="logout" className="mr-2 h-4 w-4" /> Keluar dari Academy</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
