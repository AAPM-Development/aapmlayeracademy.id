import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, IconButton } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import ProfileAvatar from "@/components/ProfileAvatar";
import { getNavigationMeta } from "./academyNavigation";

export default function AcademyHeader({
  onOpenMobile = () => {},
  showMobileMenu = true,
  themeMode = "light",
  onToggleTheme = () => {},
  onLogout = () => {},
  user = null,
  pageOverride = null,
  workspaceBadgeLabel = "Ruang Academy",
  workspaceAction = null,
  accountContextOverride = null,
} = {}) {
  const location = useLocation();
  const page = pageOverride || getNavigationMeta(location.pathname);
  const displayName = user?.full_name || user?.email || "Peserta";
  const isAdmin = user?.role === "admin";
  const accountContext = accountContextOverride || (isAdmin ? "Admin Academy" : "Peserta Layer Farm");

  return (
    <div className="aapm-token-header flex h-[var(--aapm-shell-header-height)] shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8" data-t7-region="topbar">
      <div className="flex min-w-0 items-center gap-3">
        {showMobileMenu && (
          <IconButton
            onClick={onOpenMobile}
            className="lg:hidden"
            label="Buka navigasi"
          >
            <AapmIcon name="menu" className="h-5 w-5" />
          </IconButton>
        )}
        <div className="min-w-0">
          <div className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">{page.group}</div>
          <div className="truncate text-sm font-semibold text-foreground sm:text-base">{page.label}</div>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
        {workspaceAction ? (
          <Button asChild variant="ghost" className="hidden text-xs sm:inline-flex">
            <Link to={workspaceAction.to}>
              {workspaceAction.icon && <AapmIcon name={workspaceAction.icon} className="h-4 w-4" />}
              {workspaceAction.label}
            </Link>
          </Button>
        ) : null}
        {workspaceBadgeLabel ? (
          <Badge variant="soft" className="hidden gap-2 bg-surface-subtle text-xs font-medium text-muted-foreground lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
            {workspaceBadgeLabel}
          </Badge>
        ) : null}
        <IconButton variant="ghost" onClick={onToggleTheme} label={themeMode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}>
          <AapmIcon name={themeMode === "dark" ? "themeLight" : "themeDark"} className="h-4 w-4" />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Buka menu akun ${displayName}`}
              className="academy-header__account-trigger h-9 min-w-0 max-w-full gap-2 px-2 sm:px-3"
            >
              <ProfileAvatar user={user} name={displayName} className="h-7 w-7" />
              <span className="academy-header__account-name hidden max-w-[140px] min-w-0 truncate text-xs font-medium sm:inline">{displayName}</span>
              <AapmIcon name="chevronDown" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{accountContext}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}><AapmIcon name="logout" className="mr-2 h-4 w-4" /> Keluar dari Academy</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
