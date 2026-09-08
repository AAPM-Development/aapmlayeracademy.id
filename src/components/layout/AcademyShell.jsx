import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@ten4seven/ui";
import { useAuth } from "@/lib/AuthContext";
import { useModules, useUserProgress } from "@/lib/useCourseData";
import { useThemeMode } from "@/lib/useThemeMode";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import AcademyHeader from "./AcademyHeader";
import AcademySidebar from "./AcademySidebar";
import MobileBottomNav from "./MobileBottomNav";
import FloatingAiAssistant from "@/components/ai/FloatingAiAssistant";
import { AiChatProvider } from "@/components/ai/AiChatProvider";

export default function AcademyShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(() =>
    typeof window === "undefined" || window.matchMedia("(min-width: 861px)").matches,
  );
  const location = useLocation();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();
  const mainScrollRef = useScrollEdgeFade();
  const isAiWorkspace = location.pathname === "/ai-assistant";
  const effectiveSidebarCollapsed = isDesktopSidebar && (isAiWorkspace || sidebarCollapsed);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 861px)");
    const syncViewport = () => setIsDesktopSidebar(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const handleLogout = () => logout();
  const openCanonicalNavigation = () => {
    document
      .getElementById("academy-app-shell")
      ?.querySelector(".t7-app-mobile-menu")
      ?.click();
  };

  return (
    <AiChatProvider>
      <AppShell
        id="academy-app-shell"
        contentAs="div"
        className={`academy-shell aapm-token-shell aapm-t7-app-shell ${effectiveSidebarCollapsed ? "aapm-t7-app-shell--collapsed" : ""}`}
        data-t7-region="app-shell"
        sidebar={(
          <AcademySidebar
            collapsed={effectiveSidebarCollapsed}
            onToggle={
              isAiWorkspace || !isDesktopSidebar
                ? null
                : () => setSidebarCollapsed((current) => !current)
            }
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            modules={modules}
            progress={progress}
            themeMode={themeMode}
            user={user}
          />
        )}
        topbar={(
          <AcademyHeader
            showMobileMenu={false}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            user={user}
          />
        )}
      >
        <div className="academy-shell__content flex min-h-0 min-w-0 flex-1 flex-col" data-t7-region="content-shell">
          <main ref={mainScrollRef} className="aapm-scroll-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0" data-t7-region="scrollport">
            <Outlet />
          </main>
          <MobileBottomNav
            onOpenMenu={openCanonicalNavigation}
            items={[
              { to: "/", label: "Beranda", icon: "dashboard", end: true },
              { to: "/modules", label: "Belajar", icon: "course" },
              {
                to: "/ai-assistant",
                label: "APPI",
                icon: "ai",
                accent: "orange",
                prominent: true,
              },
              { to: "/kpi", label: "KPI", icon: "kpi" },
            ]}
          />
          <FloatingAiAssistant />
        </div>
      </AppShell>
    </AiChatProvider>
  );
}
