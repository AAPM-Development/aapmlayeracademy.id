import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();
  const mainScrollRef = useScrollEdgeFade();
  const isAiWorkspace = location.pathname === "/ai-assistant";
  const effectiveSidebarCollapsed = isAiWorkspace || sidebarCollapsed;

  const handleLogout = () => logout();

  return (
    <AiChatProvider>
      <div className="academy-shell flex h-screen overflow-hidden bg-background text-foreground">
        <div className="hidden shrink-0 lg:flex">
          <AcademySidebar
            collapsed={effectiveSidebarCollapsed}
            onToggle={
              isAiWorkspace
                ? null
                : () => setSidebarCollapsed((current) => !current)
            }
            onLogout={handleLogout}
            modules={modules}
            progress={progress}
            user={user}
          />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[min(86vw,320px)] p-0 sm:max-w-none"
          >
            <SheetTitle className="sr-only">Academy navigation</SheetTitle>
            <AcademySidebar
              className="w-full border-r-0"
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
              modules={modules}
              progress={progress}
              user={user}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <AcademyHeader
            onOpenMobile={() => setMobileOpen(true)}
            showMobileMenu={false}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            user={user}
          />
          <main ref={mainScrollRef} className="aapm-scroll-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
            <Outlet />
          </main>
          <MobileBottomNav
            onOpenMenu={() => setMobileOpen(true)}
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
        </div>
        <FloatingAiAssistant />
      </div>
    </AiChatProvider>
  );
}
