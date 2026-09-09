import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, IconButton, NavItem, Progress, Sidebar } from "@ten4seven/ui";
import AppBrand from "@/components/AppBrand";
import SidebarUserCard from "./SidebarUserCard";
import { cn } from "@/lib/utils";
import { academyNavigation, getNavigationMeta } from "./academyNavigation";
import { getProgressSummary, TOTAL_MODULES } from "@/lib/academyData";
import { preloadRoute } from "@/lib/routePreloaders";

// Sidebar accepts canonical T7 icon names directly. The Academy navigation
// originally carried a mix of semantic aliases and Solar source strings, so
// this is the one translation boundary for global navigation—not a second
// visual icon system.
const canonicalIconByRoute = Object.freeze({
  "/": "dashboard",
  "/modules": "book",
  "/calculators": "analytics",
  "/kpi": "kpi",
  "/ai-assistant": "communication",
  "/profile": "user",
  "/certification": "approve",
  "/final-exam": "file",
});

function buildSidebarGroups() {
  return academyNavigation.map((group) => ({
    key: group.label.toLowerCase().replaceAll(" ", "-"),
    label: group.label,
    items: group.items.map((item) => ({
      key: item.to,
      label: item.label,
      icon: canonicalIconByRoute[item.to] || "book",
    })),
  }));
}

export default function AcademySidebar({
  collapsed = false,
  onToggle = null,
  onToggleTheme = null,
  onNavigate = () => {},
  onLogout = () => {},
  modules = [],
  progress = [],
  themeMode = "light",
  user = null,
  className = "",
} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { completed, total, percent } = getProgressSummary(modules, progress, TOTAL_MODULES);
  const displayName = user?.full_name || user?.email || "Peserta";
  const isAdmin = user?.role === "admin";
  const groups = buildSidebarGroups();
  const routeItems = groups.flatMap((group) => group.items);
  const activeKey = isAdmin && location.pathname.startsWith("/admin")
    ? "/admin"
    : getNavigationMeta(location.pathname).to || location.pathname;
  const progressDescription = `${completed} dari ${total} modul selesai`;

  const navigateTo = (to) => {
    if (!to) return;
    void preloadRoute(to);
    onNavigate();
    navigate(to);
  };

  const preloadFromSidebarEvent = (event) => {
    const target = event.target instanceof Element ? event.target.closest(".t7-nav-item") : null;
    const label = target?.querySelector(".t7-nav-label")?.textContent?.trim();
    const item = routeItems.find((candidate) => candidate.label === label);

    if (item) {
      void preloadRoute(item.key);
    }
  };

  const brand = (
    <div className="aapm-academy-sidebar__brand-stack">
      <div className="aapm-academy-sidebar__brand-row">
        <Link
          to="/"
          onClick={onNavigate}
          className="aapm-academy-sidebar__brand-link"
          aria-label="Kembali ke dashboard Academy"
        >
          <AppBrand
            variant={collapsed ? "icon" : "logo"}
            className={collapsed ? "h-8 w-8" : "h-auto w-[152px] max-w-full"}
          />
        </Link>
        {onToggle && (
          <IconButton
            icon={collapsed ? "chevronRight" : "chevronLeft"}
            label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            intent="quiet"
            size="sm"
            onClick={onToggle}
          />
        )}
      </div>

      <div className="aapm-academy-sidebar__progress" aria-label={`Progress belajar ${percent} persen, ${progressDescription}`}>
        <div className="aapm-academy-sidebar__progress-meta">
          <span>Progress belajar</span>
          <strong>{percent}%</strong>
        </div>
        <Progress
          aria-label={`Progress belajar ${percent}%`}
          value={percent}
          max={100}
        />
        {!collapsed && <p>{progressDescription}</p>}
      </div>
    </div>
  );

  const footer = (
    <div className="aapm-academy-sidebar__footer-content">
      <SidebarUserCard
        user={user}
        name={displayName}
        context={isAdmin ? "Admin Academy" : "Peserta Layer Farm"}
        collapsed={collapsed}
        active={activeKey === "/profile"}
        onClick={() => navigateTo("/profile")}
      />
      {isAdmin && (
        <NavItem
          active={location.pathname.startsWith("/admin")}
          className="aapm-academy-sidebar__admin-link"
          icon="admin"
          label="Panel admin"
          onClick={() => navigateTo("/admin")}
        />
      )}
      {onToggleTheme && (
        <Button
          type="button"
          intent="quiet"
          size="sm"
          leadingIcon={themeMode === "dark" ? "sun" : "moon"}
          className="aapm-academy-sidebar__theme-mobile"
          onClick={onToggleTheme}
        >
          {themeMode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}
        </Button>
      )}
      {!collapsed && (
        <Button
          type="button"
          intent="quiet"
          size="sm"
          leadingIcon="arrowLeft"
          className="aapm-academy-sidebar__logout"
          onClick={onLogout}
        >
          Keluar
        </Button>
      )}
    </div>
  );

  return (
    <Sidebar
      activeKey={activeKey}
      brand={brand}
      className={cn(
        "aapm-token-sidebar aapm-academy-sidebar",
        collapsed && "aapm-academy-sidebar--collapsed",
        className,
      )}
      footer={footer}
      groups={groups}
      label="Navigasi Academy"
      onFocusCapture={preloadFromSidebarEvent}
      onPointerMove={preloadFromSidebarEvent}
      onSelect={navigateTo}
    />
  );
}
