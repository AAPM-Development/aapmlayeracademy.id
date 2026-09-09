import React from "react";
import { NavLink } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

export default function MobileBottomNav({ items = [], onOpenMenu = () => {} }) {
  return (
    <nav
      aria-label="Navigasi cepat"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-start border-t border-border/80 bg-background/95 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_26px_hsl(var(--foreground)/0.07)] backdrop-blur-xl lg:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-0.5 text-[9px] font-semibold leading-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.prominent && "relative -mt-3 gap-0.5",
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
                  "flex h-6 w-8 items-center justify-center rounded-lg transition-colors",
                  item.prominent && "h-10 w-10 rounded-full border-4 border-background shadow-[0_5px_16px_hsl(var(--aapm-orange-700)/0.22)]",
                  isActive &&
                    (item.accent === "orange"
                      ? item.prominent
                        ? "bg-brand-orange text-white"
                        : "bg-tint-orange"
                      : "bg-tint-green"),
                  item.prominent && !isActive && "bg-tint-orange text-brand-orange",
                )}
              >
                <AapmIcon name={item.icon} className={item.prominent ? "h-4 w-4" : "h-3.5 w-3.5"} />
              </span>
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-0.5 text-[9px] font-semibold leading-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-6 w-8 items-center justify-center rounded-lg">
          <AapmIcon name="menu" className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">Lainnya</span>
      </button>
    </nav>
  );
}
