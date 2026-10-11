import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCertificates, useModules, useUserProgress } from "@/lib/useCourseData";
import { useLearningProfile } from "@/lib/useProfileData";
import { useThemeMode } from "@/lib/useThemeMode";
import { getNextModule, getProgressSummary, getRankProgress, TOTAL_CERTIFICATION_TIERS, TOTAL_MODULES } from "@/lib/academyData";
import { preloadRoute } from "@/lib/routePreloaders";
import FloatingAiAssistant from "@/components/ai/FloatingAiAssistant";
import { AiChatProvider } from "@/components/ai/AiChatProvider";
import LearnerQuickSearch from "@/components/search/LearnerQuickSearch";
import { Bar, Ic, Ring } from "@/design-system/canvas";
import { Tooltip } from "@/design-system/components/tooltip";
import {
  AccountMenu,
  AppShell,
  BottomNav,
  MobileTop,
  Sidebar,
  SidebarNav,
  Topbar,
} from "@/design-system/patterns/AppShell";
import { academyBottomNavigation, academyNavigation, getNavigationMeta, isFocusRoute } from "./academyNavigation";

const COLLAPSE_KEY = "aapm-sidebar-collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Journey card: course progress ring, the next module, and the learner's
 * rank with points — the single progress source of the learner shell.
 */
function JourneyCard({ summary, next, rank }) {
  const to = next ? `/modules/${next.moduleNumber}` : "/certification";
  return (
    <Link className="journey" to={to} aria-label={`Progres belajar ${summary.percent} persen. ${next ? `Lanjutkan Modul ${next.moduleNumber}` : "Semua modul selesai"}`}>
      <div className="row gap-3">
        <Ring value={summary.percent} size={46} animate />
        <div className="stack grow">
          <span className="t-heading t-heading-sm">{summary.completed} dari {summary.total} modul</span>
          <span className="t-caption t-muted t-clamp-2">{next ? `Lanjut: Modul ${next.moduleNumber} · ${next.title}` : "Semua modul tuntas · siap sertifikasi"}</span>
        </div>
      </div>
      <div className="rank">
        <span className="tile tile-xs tile-round" data-hue="gold" style={{ background: "var(--gold)", color: "var(--on-gold)" }}><Ic name="star" /></span>
        <div className="stack grow gap-1">
          <div className="row between gap-2">
            <span className="t-caption t-strong">{rank.name}</span>
            <span className="t-caption t-muted t-num">{rank.points.toLocaleString("id-ID")} poin</span>
          </div>
          <Bar value={rank.percent} size="sm" hue="gold" animate />
        </div>
      </div>
    </Link>
  );
}

export default function AcademyShell() {
  const location = useLocation();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const { data: profile } = useLearningProfile();
  const { user, logout } = useAuth();
  const { mode: themeMode, toggleTheme } = useThemeMode();
  const [collapsedPreference, setCollapsedPreference] = useState(readCollapsed);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);
  const isAiWorkspace = location.pathname === "/ai-assistant";
  const focus = isFocusRoute(location.pathname);
  const page = getNavigationMeta(location.pathname);
  const collapsed = collapsedPreference;
  const accountContext = user?.role === "super_admin" ? "Super Admin Academy" : isAdmin ? "Admin Academy" : "Peserta Layer Farm";

  const summary = getProgressSummary(modules, progress, TOTAL_MODULES);
  const next = getNextModule(modules, progress);
  const rank = getRankProgress(profile?.learning?.points);
  const certificateCount = Array.isArray(certificates) ? certificates.filter((certificate) => certificate.status !== "revoked").length : 0;
  const points = rank.points.toLocaleString("id-ID");

  const navigation = academyNavigation.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.to === "/modules") return { ...item, badge: `${summary.completed}/${summary.total}` };
      if (item.to === "/certification") return { ...item, badge: `${Math.min(certificateCount, TOTAL_CERTIFICATION_TIERS)}/${TOTAL_CERTIFICATION_TIERS}` };
      return item;
    }),
  }));

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
  const accountMenu = (compact = false) => (
    <AccountMenu
      user={user}
      context={accountContext}
      compact={compact}
      themeMode={themeMode}
      onToggleTheme={compact ? toggleTheme : undefined}
      onLogout={() => logout()}
      items={[
        { label: "Prestasi & profil", icon: "award", to: "/profile" },
        { label: "Sertifikasi", icon: "certificate", to: "/certification" },
        ...(isAdmin ? [{ label: "Panel admin", icon: "admin", to: "/admin" }] : []),
      ]}
    />
  );
  const xp = (
    <Link className="xp" to="/profile" aria-label={`${points} poin, lihat prestasi`}>
      <Ic name="star" />{points}
    </Link>
  );

  return (
    <AiChatProvider>
      {focus ? (
        <>
          <Outlet />
          {/* Focus screens reach APPI from their own bar. */}
          <FloatingAiAssistant showLauncher={false} />
        </>
      ) : (
        <AppShell
          className={isAiWorkspace ? "aapm-app--chat" : undefined}
          collapsed={collapsed}
          sidebar={(
            <Sidebar
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              brandLabel="Beranda Academy"
              label="Navigasi Academy"
              context={<JourneyCard summary={summary} next={next} rank={rank} />}
              footer={isAdmin ? (
                <Link to="/admin" className="nav-item" aria-label={collapsed ? "Panel admin" : undefined}>
                  <Ic name="shield" />
                  <span className="nav-text">Panel admin</span>
                </Link>
              ) : null}
            >
              <SidebarNav groups={navigation} collapsed={collapsed} onPreload={preload} label="Menu utama" />
            </Sidebar>
          )}
          topbar={(
            <Topbar
              search={<LearnerQuickSearch />}
              actions={(
                <>
                  {xp}
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
          mobileTop={<MobileTop title={page.label} actions={<>{xp}{accountMenu(true)}</>} />}
          bottomNav={<BottomNav items={academyBottomNavigation} label="Navigasi Academy" />}
          launcher={<FloatingAiAssistant />}
        >
          <Outlet />
        </AppShell>
      )}
    </AiChatProvider>
  );
}
