import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { useUserProgress } from "@/lib/useCourseData";
import { useThemeMode } from "@/lib/useThemeMode";
import AcademyHeader from "./AcademyHeader";
import AcademySidebar from "./AcademySidebar";

export default function AcademyShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: progress = [] } = useUserProgress();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();

  const handleLogout = () => logout();

  return (
    <div className="academy-shell flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden shrink-0 lg:flex">
        <AcademySidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          onLogout={handleLogout}
          progress={progress}
          user={user}
        />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(86vw,320px)] p-0 sm:max-w-none">
          <SheetTitle className="sr-only">Academy navigation</SheetTitle>
          <AcademySidebar
            className="w-full border-r-0"
            onNavigate={() => setMobileOpen(false)}
            onLogout={handleLogout}
            progress={progress}
            user={user}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AcademyHeader
          onOpenMobile={() => setMobileOpen(true)}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          user={user}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
