// @ts-nocheck
import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, Moon, Sun } from "lucide-react";
import AppBrand from "@/components/AppBrand";
import { Button, Sheet, SheetContent, SheetTitle } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { useThemeMode } from "@/lib/useThemeMode";
import AdminNavigation from "@/components/admin/AdminNavigation";

function AdminSidebar({ onNavigate = () => {} }) {
  return (
    <aside className="flex h-full w-[264px] flex-col border-r border-[hsl(var(--surface-border))] bg-surface-subtle">
      <Link to="/admin" onClick={onNavigate} className="flex h-[72px] items-center gap-3 border-b border-[hsl(var(--surface-border))] px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <AppBrand product="aapm" variant="icon" className="h-9 w-9" />
        <div><div className="text-sm font-semibold tracking-tight">AAPM Admin</div><div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Academy workspace</div></div>
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto"><AdminNavigation onNavigate={onNavigate} /></div>
      <div className="border-t border-[hsl(var(--surface-border))] p-4 text-xs leading-5 text-muted-foreground">Data dan kontrol hanya tampil jika didukung oleh API native.</div>
    </aside>
  );
}

export default function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const location = useLocation();
  const displayName = user?.full_name || user?.email || "Admin";

  return (
    <div className="academy-shell flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden shrink-0 lg:flex"><AdminSidebar /></div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(86vw,330px)] p-0 sm:max-w-none"><SheetTitle className="sr-only">Admin navigation</SheetTitle><AdminSidebar onNavigate={() => setMobileOpen(false)} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-default))] px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><Button type="button" size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka navigasi admin"><Menu className="h-5 w-5" /></Button><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Administration</div><div className="truncate text-sm font-semibold">{location.pathname === "/admin" ? "Overview" : "Academy management"}</div></div></div>
          <div className="flex items-center gap-1.5"><Button asChild variant="ghost" className="hidden text-xs sm:inline-flex"><Link to="/">Buka Academy</Link></Button><Button type="button" variant="ghost" size="icon" onClick={toggleTheme} aria-label={mode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}>{mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><Button type="button" variant="outline" className="hidden text-xs sm:inline-flex" onClick={() => logout()}>{displayName} · Keluar</Button></div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
