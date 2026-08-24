// @ts-nocheck
import React from "react";
import { NavLink } from "react-router-dom";
import { Badge, Icon } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { adminPrimaryNavigation, adminSecondaryNavigation } from "./adminNavigationItems";

export default function AdminNavigation({ onNavigate = () => {} } = {}) {
  return (
    <nav className="space-y-6 px-3 py-5" aria-label="Admin navigation">
      <div className="space-y-1">
        {adminPrimaryNavigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "bg-brand-green text-white shadow-sm" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {({ isActive }) => <><Icon name={item.icon} className={cn("h-[19px] w-[19px]", isActive && "brightness-0 invert")} /><span>{item.label}</span></>}
          </NavLink>
        ))}
      </div>
      <div>
        <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace berikutnya</div>
        <div className="mt-2 space-y-1">
          {adminSecondaryNavigation.map((item) => (
            <div key={item.label} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/65" aria-disabled="true" title="Belum tersedia pada API native">
              <Icon name={item.icon} className="h-[19px] w-[19px] opacity-55 grayscale" />
              <span className="flex-1">{item.label}</span>
              <Badge variant="outline" className="border-border/70 px-1.5 py-0 text-[9px] font-medium text-muted-foreground/70">Soon</Badge>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
