// @ts-nocheck
import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import ProfileAvatar from "@/components/ProfileAvatar";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { useThemeMode } from "@/lib/useThemeMode";
import AdminNavigation from "@/components/admin/AdminNavigation";
import { getAdminNavigationMeta } from "@/components/admin/adminNavigationItems";
import MobileBottomNav from "./MobileBottomNav";

function AdminSidebar({ onNavigate = () => {}, onLogout = () => {}, user = null }) {
  const displayName = user?.full_name || user?.email || "Admin";

  return (
    <aside className="flex h-full w-[264px] flex-col border-r border-[hsl(var(--surface-border))] bg-surface-subtle">
      <Link to="/admin" onClick={onNavigate} className="flex h-[73px] flex-col justify-center gap-1 border-b border-[hsl(var(--surface-border))] px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <AppBrand product="aapm" variant="logo" className="h-auto w-[150px] max-w-full" />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Ruang admin</span>
      </Link>
      <div className="aapm-scrollbar min-h-0 flex-1 overflow-y-auto"><AdminNavigation onNavigate={onNavigate} /></div>
      <div className="shrink-0 border-t border-[hsl(var(--surface-border))] p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-background/70 px-2.5 py-2">
          <ProfileAvatar user={user} name={displayName} className="h-8 w-8" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">{displayName}</div>
            <div className="text-[10px] text-muted-foreground">Admin Academy</div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 min-w-0 gap-1.5 px-2 text-[11px]">
            <Link to="/" onClick={onNavigate}>
              <AapmIcon name="dashboard" className="h-3.5 w-3.5" />
              <span className="truncate">Academy</span>
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 min-w-0 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={onLogout}>
            <AapmIcon name="logout" className="h-3.5 w-3.5" />
            <span className="truncate">Keluar</span>
          </Button>
        </div>
        <p className="mt-2 px-1 text-[10px] leading-4 text-muted-foreground">Data dan kontrol mengikuti API native.</p>
      </div>
    </aside>
  );
}

export default function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const location = useLocation();
  const displayName = user?.full_name || user?.email || "Admin";
  const page = getAdminNavigationMeta(location.pathname);

  return (
    <div className="academy-shell flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden shrink-0 lg:flex"><AdminSidebar user={user} onLogout={logout} /></div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
         <SheetContent side="left" className="h-full w-[min(86vw,330px)] p-0 sm:max-w-none"><SheetTitle className="sr-only">Navigasi admin</SheetTitle><AdminSidebar user={user} onLogout={logout} onNavigate={() => setMobileOpen(false)} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-default))] px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ruang admin</div><div className="truncate text-sm font-semibold">{page.label}</div></div></div>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" className="hidden text-xs sm:inline-flex"><Link to="/"><AapmIcon name="dashboard" className="h-4 w-4" /> Buka Academy</Link></Button>
            <IconButton variant="ghost" onClick={toggleTheme} label={mode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}><AapmIcon name={mode === "dark" ? "themeLight" : "themeDark"} className="h-4 w-4" /></IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-9 gap-2 px-2 sm:px-3">
                  <ProfileAvatar user={user} name={displayName} className="h-7 w-7" />
                  <span className="hidden max-w-[140px] truncate text-xs font-medium sm:inline">{displayName}</span>
                  <AapmIcon name="chevronDown" className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-semibold">{displayName}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">Admin Academy</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/"><AapmIcon name="dashboard" className="mr-2 h-4 w-4" /> Buka Academy learner</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}><AapmIcon name="logout" className="mr-2 h-4 w-4" /> Keluar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="aapm-scroll-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"><Outlet /></main>
        <MobileBottomNav
          onOpenMenu={() => setMobileOpen(true)}
          items={[
             { to: "/admin", label: "Ringkasan", icon: "dashboard", end: true },
             { to: "/admin/courses", label: "Course", icon: "course" },
            { to: "/", label: "Academy", icon: "dashboard", prominent: true },
            { to: "/admin/users", label: "Pengguna", icon: "users" },
          ]}
        />
      </div>
    </div>
  );
}
