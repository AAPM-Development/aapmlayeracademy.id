import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Calculator, BarChart3,
  Sparkles, Award, GraduationCap, Menu, X
} from 'lucide-react';
import { useUserProgress } from '@/lib/useCourseData';
import { useAuth } from '@/lib/AuthContext';
import AppBrand from '@/components/AppBrand';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/modules', label: 'Modul & Lesson', icon: BookOpen },
  { to: '/calculators', label: 'Kalkulator', icon: Calculator },
  { to: '/kpi', label: 'KPI Dashboard', icon: BarChart3 },
  { to: '/ai-assistant', label: 'AI Farm Assistant', icon: Sparkles },
  { to: '/certification', label: 'Sertifikasi', icon: Award },
  { to: '/final-exam', label: 'Final Exam', icon: GraduationCap },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { data: progress = [] } = useUserProgress();
  const { user: me } = useAuth();

  const completed = progress.filter(p => p.completed).length;
  const totalModules = 22;
  const pct = Math.round((completed / totalModules) * 100);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <AppBrand className="h-12 w-auto max-w-[190px]" />
      </div>

      <div className="px-4 py-4">
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-amber-700">Progres Course</span>
            <span className="text-[11px] font-semibold text-amber-700">{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-amber-600 mt-1.5">{completed} / {totalModules} modul selesai</div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {nav.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate text-sidebar-foreground">{me?.full_name || me?.email || 'Peserta'}</div>
            <div className="text-[10px] text-muted-foreground">Layer Farm Trainee</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 border-b bg-background px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <AppBrand className="h-8 w-auto max-w-[170px]" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
