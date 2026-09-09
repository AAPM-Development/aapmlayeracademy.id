// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell, Button as T7Button, IconButton, NavItem, Sidebar } from "@ten4seven/ui";
import AppBrand from "@/components/AppBrand";
import SidebarUserCard from "./SidebarUserCard";
import { useAuth } from "@/lib/AuthContext";
import { useThemeMode } from "@/lib/useThemeMode";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import { adminPrimaryNavigation, adminSecondaryNavigation, getAdminNavigationMeta } from "@/components/admin/adminNavigationItems";
import MobileBottomNav from "./MobileBottomNav";
import AcademyHeader from "./AcademyHeader";
import { preloadRoute } from "@/lib/routePreloaders";

const canonicalIconByRoute = Object.freeze({
  "/admin": "dashboard",
  "/admin/courses": "book",
  "/admin/users": "users",
  "/admin/ai-settings": "settings",
  "/admin/workspace-status": "fileCheck",
});

function buildAdminSidebarGroups() {
  return [
    {
      key: "administrasi",
      label: "Administrasi",
      items: adminPrimaryNavigation.map((item) => ({
        key: item.to,
        label: item.label,
        icon: canonicalIconByRoute[item.to] || "file",
      })),
    },
    {
      key: "workspace",
      label: "Ruang kerja",
      items: adminSecondaryNavigation.map((item) => ({
        key: item.to,
        label: item.label,
        icon: canonicalIconByRoute[item.to] || "fileCheck",
      })),
    },
  ];
}

function AdminSidebar({
  collapsed = false,
  onToggle = null,
  onNavigate = () => {},
  onLogout = () => {},
  onToggleTheme = null,
  themeMode = "light",
  user = null,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const displayName = user?.full_name || user?.email || "Admin";
  const groups = buildAdminSidebarGroups();
  const routeItems = groups.flatMap((group) => group.items);
  const activeKey = getAdminNavigationMeta(location.pathname).to || "/admin";

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
          to="/admin"
          onClick={onNavigate}
          className="aapm-academy-sidebar__brand-link"
          aria-label="Kembali ke ringkasan admin"
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
      <span className="aapm-admin-sidebar__context">Ruang admin</span>
    </div>
  );

  const footer = (
    <div className="aapm-academy-sidebar__footer-content">
      <NavItem
        active={false}
        className="aapm-academy-sidebar__academy-link"
        icon="dashboard"
        label="Buka Academy"
        onClick={() => navigateTo("/")}
      />
      <SidebarUserCard
        user={user}
        name={displayName}
        context="Admin Academy"
        collapsed={collapsed}
        active={location.pathname === "/profile"}
        onClick={() => navigateTo("/profile")}
      />
      {onToggleTheme && (
        <T7Button
          type="button"
          intent="quiet"
          size="sm"
          leadingIcon={themeMode === "dark" ? "sun" : "moon"}
          className="aapm-academy-sidebar__theme-mobile"
          onClick={onToggleTheme}
        >
          {themeMode === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}
        </T7Button>
      )}
      {!collapsed && (
        <T7Button
          type="button"
          intent="quiet"
          size="sm"
          leadingIcon="arrowLeft"
          className="aapm-academy-sidebar__logout"
          onClick={onLogout}
        >
          Keluar
        </T7Button>
      )}
    </div>
  );

  return (
    <Sidebar
      activeKey={activeKey}
      brand={brand}
      className={`aapm-token-sidebar aapm-academy-sidebar aapm-admin-sidebar ${collapsed ? "aapm-academy-sidebar--collapsed" : ""}`}
      data-t7-region="admin-sidebar"
      footer={footer}
      groups={groups}
      label="Navigasi admin"
      onFocusCapture={preloadFromSidebarEvent}
      onPointerMove={preloadFromSidebarEvent}
      onSelect={navigateTo}
    />
  );
}

export default function AdminShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(() =>
    typeof window === "undefined" || window.matchMedia("(min-width: 861px)").matches,
  );
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const location = useLocation();
  const page = getAdminNavigationMeta(location.pathname);
  const mainScrollRef = useScrollEdgeFade();
  const effectiveSidebarCollapsed = isDesktopSidebar && sidebarCollapsed;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 861px)");
    const syncViewport = () => setIsDesktopSidebar(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  // The admin AppShell also preserves its scrollport across route changes.
  // Always begin a new surface at its heading instead of inheriting the
  // previous editor/list position on narrow screens.
  useEffect(() => {
    document
      .querySelector("#admin-app-shell [data-t7-region=scrollport]")
      ?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const openCanonicalNavigation = () => {
    document
      .getElementById("admin-app-shell")
      ?.querySelector(".t7-app-mobile-menu")
      ?.click();
  };

  return (
    <AppShell
      id="admin-app-shell"
      contentAs="div"
      className={`academy-shell aapm-token-shell aapm-t7-app-shell aapm-admin-shell ${effectiveSidebarCollapsed ? "aapm-t7-app-shell--collapsed" : ""}`}
      data-t7-region="admin-shell"
      sidebar={(
        <AdminSidebar
          collapsed={effectiveSidebarCollapsed}
          onToggle={isDesktopSidebar ? () => setSidebarCollapsed((current) => !current) : null}
          user={user}
          onLogout={logout}
          onToggleTheme={toggleTheme}
          themeMode={mode}
        />
      )}
      topbar={(
        <AcademyHeader
          showMobileMenu={false}
          pageOverride={{ ...page, group: "Ruang admin" }}
          workspaceBadgeLabel="Ruang admin"
          workspaceAction={{ to: "/", label: "Buka Academy", icon: "dashboard" }}
          accountContextOverride="Admin Academy"
          themeMode={mode}
          onToggleTheme={toggleTheme}
          onLogout={logout}
          user={user}
        />
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-t7-region="content-shell">
        <main ref={mainScrollRef} className="aapm-scroll-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0" data-t7-region="scrollport"><Outlet /></main>
        <MobileBottomNav
          onOpenMenu={openCanonicalNavigation}
          items={[
             { to: "/admin", label: "Ringkasan", icon: "dashboard", end: true },
             { to: "/admin/courses", label: "Course", icon: "course" },
            { to: "/", label: "Academy", icon: "dashboard", prominent: true },
            { to: "/admin/users", label: "Pengguna", icon: "users" },
          ]}
        />
      </div>
    </AppShell>
  );
}
