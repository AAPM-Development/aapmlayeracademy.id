import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useThemeMode } from "@/lib/useThemeMode";
import { preloadRoute } from "@/lib/routePreloaders";
import { Breadcrumbs } from "@/design-system";
import { Ic } from "@/design-system/canvas";
import { Tooltip } from "@/design-system/components/tooltip";
import {
  AccountMenu,
  AppShell,
  BottomNav,
  MobileTop,
  NavigationSheet,
  Sidebar,
  SidebarNav,
  Topbar,
} from "@/design-system/patterns/AppShell";
import FloatingAiAssistant from "@/components/ai/FloatingAiAssistant";
import { AiChatProvider } from "@/components/ai/AiChatProvider";
import AdminQuickSearch from "@/components/admin/AdminQuickSearch";
import { adminBottomNavigation, adminNavigationGroups, getAdminBreadcrumbs, getAdminNavigationMeta } from "@/components/admin/adminNavigationItems";

const COLLAPSE_KEY = "aapm-admin-sidebar-collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Academy | Admin context switch: one control instead of scattered "back to Academy" links. */
function WorkspaceSwitch({ onNavigate }) {
  return (
    <nav className="ctx-switch" aria-label="Pilih ruang kerja">
      <Link to="/" onClick={onNavigate}><Ic name="grad" size="sm" /><span className="ctx-text">Academy</span></Link>
      <Link className="is-on" to="/admin" aria-current="page" onClick={onNavigate}><Ic name="shield" size="sm" /><span className="ctx-text">Admin</span></Link>
    </nav>
  );
}

/**
 * Admin workspace: the learner shell frame in the calm tone (1 px lines,
 * 3 px ledges, no decorative motion), grouped navigation and linked
 * breadcrumbs in the topbar.
 */
export default function AdminShell() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();
  const [collapsedPreference, setCollapsedPreference] = useState(readCollapsed);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isEditor = /^\/admin\/courses\/[^/]+\/modules\//.test(location.pathname);
  const collapsed = collapsedPreference || isEditor;
  const roleLabel = user?.role === "super_admin" ? "Super Admin" : "Admin";

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
        label="Navigasi admin"
        collapsed={inSheet ? false : collapsed}
        onToggle={inSheet || isEditor ? null : toggleCollapsed}
        context={<WorkspaceSwitch onNavigate={close} />}
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

  const accountMenu = (compact = false) => (
    <AccountMenu
      user={user}
      meta={roleLabel}
      compact={compact}
      context={`${roleLabel} Academy`}
      themeMode={themeMode}
      onToggleTheme={compact ? toggleTheme : undefined}
      onLogout={() => logout()}
      items={[
        { label: "Buka Academy", icon: "graduation", to: "/" },
        { label: "Profil saya", icon: "user", to: "/profile" },
      ]}
    />
  );

  // The module editor is a focus screen: its own bar, no sidebar or topbar.
  if (isEditor) {
    return (
      <AiChatProvider>
        <Outlet />
        <FloatingAiAssistant showLauncher={false} />
      </AiChatProvider>
    );
  }

  return (
    <AiChatProvider>
      <AppShell
        tone="calm"
        collapsed={collapsed}
        mainLabel="Konten admin"
        sidebar={navigation(false)}
        topbar={(
          <Topbar
            breadcrumbs={<Breadcrumbs items={getAdminBreadcrumbs(location.pathname)} />}
            actions={(
              <>
                <AdminQuickSearch />
                <Tooltip content={themeMode === "dark" ? "Mode terang" : "Mode gelap"}>
                  <button type="button" className="btn btn-ghost btn-icon btn-quiet" aria-label={themeMode === "dark" ? "Mode terang" : "Mode gelap"} onClick={toggleTheme}>
                    <Ic name={themeMode === "dark" ? "sun" : "moon"} />
                  </button>
                </Tooltip>
                {accountMenu()}
              </>
            )}
          />
        )}
        mobileTop={<MobileTop brandTo="/admin" title={getAdminNavigationMeta(location.pathname).label} actions={accountMenu(true)} />}
        // The module editor brings its own bottom bar, so the shell's bar is off there.
        bottomNav={isEditor ? null : (
          <BottomNav
            label="Navigasi admin cepat"
            items={[...adminBottomNavigation, { label: "Menu", ic: "menu", expanded: sheetOpen, onClick: () => setSheetOpen(true) }]}
          />
        )}
        launcher={<FloatingAiAssistant />}
      >
        <Outlet />
      </AppShell>
      <NavigationSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Navigasi admin">
        {navigation(true)}
      </NavigationSheet>
    </AiChatProvider>
  );
}
