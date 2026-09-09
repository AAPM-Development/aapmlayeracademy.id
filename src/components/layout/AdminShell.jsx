// @ts-nocheck
import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell, Button as T7Button, NavItem, Sidebar } from "@ten4seven/ui";
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
} from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { useThemeMode } from "@/lib/useThemeMode";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import { adminPrimaryNavigation, adminSecondaryNavigation, getAdminNavigationMeta } from "@/components/admin/adminNavigationItems";
import MobileBottomNav from "./MobileBottomNav";
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
          <AppBrand variant="logo" className="h-auto w-[152px] max-w-full" />
        </Link>
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
      <NavItem
        active={false}
        className="aapm-academy-sidebar__account"
        icon="user"
        label={displayName}
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
    </div>
  );

  return (
    <Sidebar
      activeKey={activeKey}
      brand={brand}
      className="aapm-token-sidebar aapm-academy-sidebar aapm-admin-sidebar"
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
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const location = useLocation();
  const displayName = user?.full_name || user?.email || "Admin";
  const page = getAdminNavigationMeta(location.pathname);
  const mainScrollRef = useScrollEdgeFade();
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
      className="academy-shell aapm-token-shell aapm-t7-app-shell"
      data-t7-region="admin-shell"
      sidebar={<AdminSidebar user={user} onLogout={logout} onToggleTheme={toggleTheme} themeMode={mode} />}
      topbar={(
        <div className="aapm-token-header flex h-[var(--aapm-shell-header-height)] shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8" data-t7-region="topbar">
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
        </div>
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
