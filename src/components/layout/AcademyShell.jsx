import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useModules, useUserProgress } from "@/lib/useCourseData";
import { useThemeMode } from "@/lib/useThemeMode";
import { getNextModule, getProgressSummary, TOTAL_MODULES } from "@/lib/academyData";
import { preloadRoute } from "@/lib/routePreloaders";
import FloatingAiAssistant from "@/components/ai/FloatingAiAssistant";
import { AiChatProvider } from "@/components/ai/AiChatProvider";
import { Breadcrumbs, IconButton, ProgressRing } from "@/design-system";
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
import { academyBottomNavigation, academyNavigation, getNavigationMeta, isFocusRoute } from "./academyNavigation";

const COLLAPSE_KEY = "aapm-sidebar-collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Course progress at a glance; links straight to the next module. */
function SidebarProgress({ modules, progress, onNavigate }) {
  const { completed, total, percent } = getProgressSummary(modules, progress, TOTAL_MODULES);
  const next = getNextModule(modules, progress);
  const to = next ? `/modules/${next.moduleNumber}` : "/certification";
  return (
    <Link to={to} className="aapm-sidebar-progress" onClick={onNavigate} aria-label={`Progress belajar ${percent} persen. ${next ? `Lanjutkan modul ${next.moduleNumber}` : "Semua modul selesai"}`}>
      <ProgressRing value={percent} size={44} stroke={5} />
      <div className="min-w-0">
        <p className="aapm-sidebar-progress__title">{completed}/{total} modul selesai</p>
        <p className="aapm-sidebar-progress__meta">{next ? `Lanjut: ${next.title}` : "Siap sertifikasi"}</p>
      </div>
    </Link>
  );
}

export default function AcademyShell() {
  const location = useLocation();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();
  const [collapsedPreference, setCollapsedPreference] = useState(readCollapsed);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);
  const isAiWorkspace = location.pathname === "/ai-assistant";
  const focus = isFocusRoute(location.pathname);
  const page = getNavigationMeta(location.pathname);
  const collapsed = isAiWorkspace || collapsedPreference;
  const accountContext = user?.role === "super_admin" ? "Super Admin Academy" : isAdmin ? "Admin Academy" : "Peserta Layer Farm";

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

  const preload = (to) => void preloadRoute(to);
  const navigation = (inSheet = false) => (
    <Sidebar
      collapsed={inSheet ? false : collapsed}
      onToggle={inSheet || isAiWorkspace ? null : toggleCollapsed}
      brandLabel="Beranda Academy"
      context={<SidebarProgress modules={modules} progress={progress} onNavigate={inSheet ? () => setSheetOpen(false) : undefined} />}
      footer={isAdmin ? (
        <Link to="/admin" className="aapm-nav-item" aria-label={collapsed ? "Panel admin" : undefined} onClick={inSheet ? () => setSheetOpen(false) : undefined}>
          <AapmIcon name="admin" />
          <span className="aapm-nav-item__label">Panel admin</span>
        </Link>
      ) : null}
    >
      <SidebarNav
        groups={academyNavigation}
        collapsed={inSheet ? false : collapsed}
        onPreload={preload}
        onNavigate={inSheet ? () => setSheetOpen(false) : undefined}
        label="Navigasi Academy"
      />
    </Sidebar>
  );

  const accountMenu = (
    <AccountMenu
      user={user}
      context={accountContext}
      themeMode={themeMode}
      onToggleTheme={toggleTheme}
      onLogout={() => logout()}
      items={[
        { label: "Profil & prestasi", icon: "user", to: "/profile" },
        { label: "Sertifikasi", icon: "certificate", to: "/certification" },
        ...(isAdmin ? [{ label: "Panel admin", icon: "admin", to: "/admin" }] : []),
      ]}
    />
  );

  return (
    <AiChatProvider>
      {focus ? (
        <Outlet />
      ) : (
        <AppShell
          className={isAiWorkspace ? "aapm-app--chat" : undefined}
          collapsed={collapsed}
          label="Navigasi Academy"
          sidebar={navigation(false)}
          topbar={(
            <Topbar
              breadcrumbs={<Breadcrumbs items={[{ label: page.group }, { label: page.label }]} />}
              actions={(
                <>
                  {/* APPI is reached from the sidebar and the floating launcher;
                      a third topbar entry only repeated them. */}
                  <IconButton
                    label={themeMode === "dark" ? "Mode terang" : "Mode gelap"}
                    icon={themeMode === "dark" ? "themeLight" : "themeDark"}
                    onClick={toggleTheme}
                    data-desktop-only=""
                  />
                  {accountMenu}
                </>
              )}
            />
          )}
          bottomNav={(
            <BottomNav
              items={[
                ...academyBottomNavigation,
                { label: "Menu", icon: "menu", expanded: sheetOpen, onClick: () => setSheetOpen(true) },
              ]}
            />
          )}
        >
          <Outlet />
        </AppShell>
      )}
      <NavigationSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Navigasi Academy">
        {navigation(true)}
      </NavigationSheet>
      <FloatingAiAssistant />
    </AiChatProvider>
  );
}
