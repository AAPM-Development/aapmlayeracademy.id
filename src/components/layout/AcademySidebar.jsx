import React from "react";
import { ChevronLeft, ChevronRight, LogOut, TrendingUp } from "lucide-react";
import { NavLink } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import { Badge } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/icon-tile";
import { academyNavigation } from "./academyNavigation";
import { cn } from "@/lib/utils";
import { getCompletedModuleSet, TOTAL_MODULES } from "@/lib/academyData";

export default function AcademySidebar({
  collapsed = false,
  onToggle = () => {},
  onNavigate = () => {},
  onLogout = () => {},
  progress = [],
  user = null,
  className = "",
} = {}) {
  const completed = getCompletedModuleSet(progress).size;
  const percent = Math.round((completed / TOTAL_MODULES) * 100);
  const displayName = user?.full_name || user?.email || "Peserta";

  return (
    <aside className={cn("relative flex h-full min-h-0 flex-col border-r border-border bg-surface-subtle transition-[width] duration-200", collapsed ? "w-[76px]" : "w-64", className)}>
      <div className={cn("flex h-[73px] shrink-0 items-center border-b border-border", collapsed ? "justify-center px-3" : "justify-between px-4")}>
        <AppBrand variant={collapsed ? "icon" : "logo"} className={collapsed ? "h-9 w-9" : "h-11 w-auto max-w-[182px]"} />
        <button
          type="button"
          onClick={onToggle}
          className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "absolute -right-3 top-5 z-10 border bg-background shadow-sm")}
          aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn("shrink-0", collapsed ? "px-3 py-4" : "px-4 py-5")}>
        <div className={cn("relative overflow-hidden rounded-2xl border border-tint-green-border bg-gradient-to-br from-tint-green via-surface-elevated to-tint-orange/35", collapsed ? "p-2" : "p-3")}>
          <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full border-8 border-white/40" />
          {collapsed ? (
            <div className="text-center">
              <div className="text-sm font-semibold text-brand-orange">{percent}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-orange" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex items-start gap-2.5">
                <IconTile icon={TrendingUp} tone="orange" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-foreground">Learning progress</span>
                    <Badge variant="soft" className="bg-card/70 px-2 py-0.5 text-[10px] tabular-nums text-brand-orange">{percent}%</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{completed} dari {TOTAL_MODULES} modul selesai</div>
                </div>
              </div>
              <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-brand-orange transition-[width]" style={{ width: `${percent}%` }} />
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Navigasi utama">
        {academyNavigation.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed && <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</div>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      collapsed && "justify-center px-0",
                      isActive ? "bg-brand-green/10 font-semibold text-brand-green shadow-sm ring-1 ring-brand-green/10" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.to === "/modules" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-orange opacity-0 transition-opacity group-[.active]:opacity-100" />}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0", collapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-xs font-semibold text-brand-green">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground">{displayName}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Layer Farm learner</div>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Keluar"
            className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "hidden")}
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
