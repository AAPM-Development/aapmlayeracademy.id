import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useThemeMode } from "@/lib/useThemeMode";
import { preloadRoute } from "@/lib/routePreloaders";
import { Breadcrumbs, Button, IconButton } from "@/design-system";
import {
  AccountMenu,
  AppShell,
  BottomNav,
  NavigationSheet,
  Sidebar,
  SidebarNav,
  Topbar,
} from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { adminBottomNavigation, adminNavigationGroups, getAdminBreadcrumbs } from "@/components/admin/adminNavigationItems";

const COLLAPSE_KEY = "aapm-admin-sidebar-collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Workspace identity in the sidebar: the admin twin of the learner progress card. */
function AdminWorkspaceCard() {
  return (
    <Link to="/admin" className="aapm-sidebar-card" aria-label="Ruang admin, ringkasan">
      <span className="aapm-sidebar-card__icon" aria-hidden="true"><AapmIcon name="admin" /></span>
      <span className="min-w-0">
        <span className="aapm-sidebar-card__title">Ruang admin</span>
        <span className="aapm-sidebar-card__meta">Kelola data native</span>
      </span>
    </Link>
  );
}

/**
 * Admin workspace: the same shell DNA as the learner Academy, with an
 * explicit workspace context so admins always know which side they are on.
 */
export default function AdminShell() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();
  const [collapsedPreference, setCollapsedPreference] = useState(readCollapsed);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The module editor is a wide workspace; give it the room by default.
  const isEditor = /^\/admin\/courses\/[^/]+\/modules\//.test(location.pathname);
  const collapsed = collapsedPreference || isEditor;

  useEffect(() => setSheetOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsedPreference((current) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(!current));
      } catch {
        // Preference is optional.
      }
      return !current;
    });
  };

  const navigation = (inSheet = false) => {
    const close = inSheet ? () => setSheetOpen(false) : undefined;
    return (
      <Sidebar
        brandTo="/admin"
        brandLabel="Ringkasan admin"
        collapsed={inSheet ? false : collapsed}
        onToggle={inSheet || isEditor ? null : toggleCollapsed}
        context={<AdminWorkspaceCard />}
        footer={(
          <Link to="/" className="aapm-nav-item" aria-label={collapsed ? "Kembali ke Academy" : undefined} onClick={close}>
            <AapmIcon name="arrowLeft" />
            <span className="aapm-nav-item__label">Kembali ke Academy</span>
          </Link>
        )}
      >
        <SidebarNav
          groups={adminNavigationGroups}
          collapsed={inSheet ? false : collapsed}
          onPreload={(to) => void preloadRoute(to)}
          onNavigate={close}
          label="Navigasi admin"
        />
      </Sidebar>
    );
  };

  return (
    <>
      <AppShell
        collapsed={collapsed}
        label="Navigasi admin"
        mainLabel="Konten admin"
        sidebar={navigation(false)}
        topbar={(
          <Topbar
            mobileBrandTo="/admin"
            breadcrumbs={<Breadcrumbs items={getAdminBreadcrumbs(location.pathname)} />}
            actions={(
              <>
                <Button asChild variant="ghost" size="sm" data-desktop-only="">
                  <Link to="/"><AapmIcon name="dashboard" /> Lihat Academy</Link>
                </Button>
                <IconButton
                  label={themeMode === "dark" ? "Mode terang" : "Mode gelap"}
                  icon={themeMode === "dark" ? "themeLight" : "themeDark"}
                  onClick={toggleTheme}
                  data-desktop-only=""
                />
                <AccountMenu
                  user={user}
                  context="Admin Academy"
                  themeMode={themeMode}
                  onToggleTheme={toggleTheme}
                  onLogout={() => logout()}
                  items={[
                    { label: "Buka Academy", icon: "dashboard", to: "/" },
                    { label: "Profil saya", icon: "user", to: "/profile" },
                  ]}
                />
              </>
            )}
          />
        )}
        bottomNav={(
          <BottomNav
            label="Navigasi admin cepat"
            items={[...adminBottomNavigation, { label: "Menu", icon: "menu", onClick: () => setSheetOpen(true) }]}
          />
        )}
      >
        <Outlet />
      </AppShell>
      <NavigationSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Navigasi admin">
        {navigation(true)}
      </NavigationSheet>
    </>
  );
}
