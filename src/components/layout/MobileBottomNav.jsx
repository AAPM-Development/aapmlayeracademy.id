import React from "react";
import { NavLink } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

export default function MobileBottomNav({ items = [], onOpenMenu = () => {} }) {
  return (
    <nav
      aria-label="Navigasi cepat"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start border-t border-border/80 bg-background/95 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-10px_26px_hsl(var(--foreground)/0.07)] backdrop-blur-xl lg:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-semibold leading-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? item.accent === "orange"
                  ? "text-brand-orange"
                  : "text-brand-green"
                : "text-muted-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-lg transition-colors",
                  isActive &&
                    (item.accent === "orange"
                      ? "bg-tint-orange"
                      : "bg-tint-green"),
                )}
              >
                <AapmIcon name={item.icon} className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-semibold leading-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-7 w-8 items-center justify-center rounded-lg">
          <AapmIcon name="menu" className="h-4 w-4" />
        </span>
        <span className="truncate">Lainnya</span>
      </button>
    </nav>
  );
}
