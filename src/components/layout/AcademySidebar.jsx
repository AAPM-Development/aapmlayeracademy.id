import React from "react";
import { Link, NavLink } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, IconButton } from "@/components/primitives";
import { academyNavigation } from "./academyNavigation";
import { cn } from "@/lib/utils";
import { getCompletedModuleSet, TOTAL_MODULES } from "@/lib/academyData";

export default function AcademySidebar({
  collapsed = false,
  onToggle = null,
  onNavigate = () => {},
  onLogout = () => {},
  progress = [],
  user = null,
  className = "",
} = {}) {
  const completed = getCompletedModuleSet(progress).size;
  const percent = Math.round((completed / TOTAL_MODULES) * 100);
  const displayName = user?.full_name || user?.email || "Peserta";
  const isAdmin = user?.role === "admin";

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 flex-col border-r border-[hsl(var(--surface-border))] bg-surface-subtle transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[264px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-[73px] shrink-0 items-center border-b border-[hsl(var(--surface-border))]",
          collapsed
            ? "justify-center gap-1 px-2"
            : "justify-between gap-3 px-5",
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            "min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "flex items-center justify-center",
          )}
          aria-label="Kembali ke dashboard Academy"
        >
          <AppBrand
            variant={collapsed ? "icon" : "logo"}
            className={collapsed ? "h-8 w-8" : "h-10 w-auto max-w-[176px]"}
          />
          {!collapsed && (
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Learning workspace
            </span>
          )}
        </Link>
        {onToggle && (
          <IconButton
            onClick={onToggle}
            size="sm"
            className={cn("h-8 w-8 shrink-0 rounded-lg border border-border/70 bg-background/80 text-muted-foreground hover:bg-surface-hover hover:text-foreground", collapsed && "h-7 w-7")}
            label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          >
            <AapmIcon
              name={collapsed ? "chevronRight" : "chevronLeft"}
              className="h-4 w-4"
            />
          </IconButton>
        )}
      </div>

      <div className={cn("shrink-0", collapsed ? "px-3 py-4" : "px-4 py-5")}>
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-tint-green-border bg-tint-green",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {collapsed ? (
            <div className="text-center">
              <div className="text-sm font-semibold text-brand-green">
                {percent}%
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-lime"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-lime text-tint-lime-foreground">
                  <AapmIcon name="progress" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-foreground">
                      Learning progress
                    </span>
                    <Badge
                      variant="soft"
                      className="bg-card/70 px-2 py-0.5 text-[10px] tabular-nums text-brand-green"
                    >
                      {percent}%
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {completed} dari {TOTAL_MODULES} modul selesai
                  </div>
                </div>
              </div>
              <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-brand-lime transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
        aria-label="Navigasi utama"
      >
        {academyNavigation.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            {!collapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-brand-green text-white shadow-sm"
                          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <AapmIcon
                          name={item.icon}
                          className={cn(
                            "h-[19px] w-[19px] shrink-0",
                            isActive && "brightness-0 invert",
                          )}
                        />
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                        {!collapsed && item.to === "/modules" && (
                          <span
                            className={cn(
                              "ml-auto h-1.5 w-1.5 rounded-full bg-brand-orange opacity-0 transition-opacity",
                              isActive && "bg-brand-lime opacity-100",
                            )}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0", collapsed ? "p-3" : "p-4")}>
        {isAdmin && (
          <Link
            to="/admin"
            onClick={onNavigate}
            title={collapsed ? "Panel Admin" : undefined}
            className={cn(
              "mb-3 flex items-center gap-2 rounded-xl border border-tint-orange-border bg-tint-orange text-tint-orange-foreground transition-colors hover:bg-brand-orange hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed ? "h-10 justify-center" : "px-3 py-2.5 text-xs font-semibold",
            )}
          >
            <AapmIcon name="dashboard" className="h-4 w-4" />
            {!collapsed && <span>Panel Admin</span>}
          </Link>
        )}
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-xs font-semibold text-brand-green">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <Link to="/profile" onClick={onNavigate} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="truncate text-xs font-semibold text-foreground">
                {displayName}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Lihat profil & prestasi
              </div>
            </Link>
          )}
          <IconButton
            onClick={onLogout}
            size="sm"
            className={cn("shrink-0", collapsed && "hidden")}
            label="Keluar"
          >
            <AapmIcon name="logout" className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}
