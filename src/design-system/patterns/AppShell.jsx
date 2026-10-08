import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AppBrand from "@/components/AppBrand";
import ProfileAvatar from "@/components/ProfileAvatar";
import { cn } from "@/lib/utils";
import { Tooltip } from "../components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
} from "../components/overlays";
import { IconButton } from "../components/actions";
import { StateView } from "../components/display";

/** Reset the shell's single scroll owner whenever the route changes. */
function useResetScroll(ref, key) {
  React.useEffect(() => {
    ref.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [ref, key]);
}

/**
 * React Router commits a navigation inside a transition, so while a lazy
 * route chunk loads the address has moved but the old page (and its active
 * nav item) stays up with no sign the click registered. Compare the address
 * with the rendered route after each click or history step: if they differ,
 * the next route is still on its way.
 */
function useRoutePending(pathname) {
  const [pending, setPending] = React.useState(false);
  const rendered = React.useRef(pathname);

  React.useEffect(() => {
    rendered.current = pathname;
    setPending(false);
  }, [pathname]);

  const check = React.useCallback(() => {
    window.setTimeout(() => {
      if (window.location.pathname !== rendered.current) setPending(true);
    }, 0);
  }, []);

  React.useEffect(() => {
    window.addEventListener("popstate", check);
    return () => window.removeEventListener("popstate", check);
  }, [check]);

  return [pending, check];
}

/**
 * Dashboard shell (AAPM Farm anatomy): persistent sidebar, sticky topbar and
 * one scrolling canvas; on phones the sidebar becomes a sheet and a bottom
 * navigation bar carries the most frequent destinations.
 */
export function AppShell({ sidebar, topbar, bottomNav, collapsed = false, children, className, label = "Navigasi utama", mainLabel = "Konten" }) {
  const location = useLocation();
  const mainRef = React.useRef(null);
  useResetScroll(mainRef, location.pathname);
  const [pending, checkPending] = useRoutePending(location.pathname);

  return (
    <div
      className={cn("aapm-app", className)}
      data-collapsed={collapsed ? "true" : "false"}
      data-bottom-nav={bottomNav ? "true" : undefined}
      onClickCapture={checkPending}
    >
      <a className="aapm-skip-link" href="#aapm-main">Lewati ke konten</a>
      <aside className="aapm-app__sidebar" aria-label={label}>{sidebar}</aside>
      <div className="aapm-app__canvas">
        <div className="aapm-route-progress" data-active={pending ? "true" : undefined} aria-hidden="true" />
        {topbar}
        <main id="aapm-main" ref={mainRef} tabIndex={-1} className="aapm-app__main" aria-label={mainLabel} aria-busy={pending || undefined}>
          {/* The chrome paints at once on a hard load; only the canvas waits
              for the first route chunk. */}
          <React.Suspense fallback={<StateView kind="loading" title="Menyiapkan halaman…" framed={false} />}>
            {children}
          </React.Suspense>
        </main>
      </div>
      {bottomNav}
    </div>
  );
}

/** Route page container: one width, inset and vertical rhythm for every route. */
export function Page({ width, flush, className, children, ...props }) {
  return (
    <div className={cn("aapm-page", className)} data-width={width} data-flush={flush ? "true" : undefined} {...props}>
      {children}
    </div>
  );
}

/**
 * Standalone status page for a visitor outside any shell (signed-out 404,
 * access denied, boot failure): the wordmark at its system size above one
 * page-level StateView, centred on the canvas.
 */
export function StatusPage({ children, className }) {
  return (
    <main className={cn("aapm-status-page", className)}>
      <div className="aapm-status-page__inner">
        <AppBrand variant="logo" className="aapm-status-page__brand" alt="AAPM Layer Academy" />
        {children}
      </div>
    </main>
  );
}

function isItemActive(item, pathname) {
  if (item.match) return item.match(pathname);
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** Grouped navigation. Items: { to, label, icon, end?, accent?, badge?, match? }. */
export function SidebarNav({ groups = [], collapsed = false, onNavigate, onPreload, label = "Navigasi" }) {
  const location = useLocation();
  return (
    <nav className="aapm-nav" aria-label={label}>
      {groups.map((group) => (
        <div key={group.label} className="aapm-nav__group" role="group" aria-label={group.label}>
          <p className="aapm-nav__group-label aapm-text-overline">{group.label}</p>
          {group.items.map((item) => {
            const active = isItemActive(item, location.pathname);
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="aapm-nav-item"
                aria-current={active ? "page" : undefined}
                data-accent={item.accent}
                aria-label={collapsed ? item.label : undefined}
                onClick={onNavigate}
                onMouseEnter={() => onPreload?.(item.to)}
                onFocus={() => onPreload?.(item.to)}
              >
                <AapmIcon name={item.icon} />
                <span className="aapm-nav-item__label">{item.label}</span>
                {item.badge ? <span className="aapm-nav-item__badge">{item.badge}</span> : null}
              </NavLink>
            );
            return collapsed ? <Tooltip key={item.to} content={item.label} side="right">{link}</Tooltip> : link;
          })}
        </div>
      ))}
    </nav>
  );
}

/** Sidebar frame: brand row, optional context, scrolling nav and footer. */
export function Sidebar({ brandTo = "/", brandLabel = "Beranda", collapsed = false, onToggle, context, children, footer }) {
  return (
    <div className="aapm-sidebar">
      <div className="aapm-sidebar__brand">
        <Link to={brandTo} className="aapm-sidebar__brand-link" aria-label={brandLabel}>
          <AppBrand variant={collapsed ? "icon" : "logo"} className="h-auto" />
        </Link>
        {onToggle ? (
          <IconButton
            label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            icon="sidebar"
            size="sm"
            onClick={onToggle}
            data-sidebar-expanded-only={collapsed ? undefined : true}
          />
        ) : null}
      </div>
      {context}
      <div className="aapm-sidebar__scroll">{children}</div>
      {footer ? <div className="aapm-sidebar__footer">{footer}</div> : null}
    </div>
  );
}

/** Account dropdown for topbar or sidebar footer. */
export function AccountMenu({ user, context, items = [], onLogout, variant = "topbar", themeMode, onToggleTheme }) {
  const displayName = user?.full_name || user?.email || "Peserta";
  const trigger = variant === "sidebar" ? (
    <button type="button" className="aapm-account-row" aria-label={`Menu akun ${displayName}`}>
      <ProfileAvatar user={user} name={displayName} className="h-8 w-8" />
      <span className="aapm-account-row__copy">
        <span className="aapm-account-row__name">{displayName}</span>
        <span className="aapm-account-row__meta">{context}</span>
      </span>
      <AapmIcon name="chevronUp" />
    </button>
  ) : (
    <button type="button" className="aapm-profile-trigger" aria-label={`Menu akun ${displayName}`}>
      <ProfileAvatar user={user} name={displayName} className="h-8 w-8" />
      <span className="aapm-profile-trigger__name">{displayName}</span>
      <AapmIcon name="chevronDown" />
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-64">
        <div className="aapm-profile-identity">
          <strong className="truncate">{displayName}</strong>
          <span className="truncate">{context}</span>
        </div>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.label} icon={item.to ? undefined : item.icon} asChild={Boolean(item.to)} onSelect={item.onSelect}>
            {item.to ? <Link to={item.to}><AapmIcon name={item.icon} />{item.label}</Link> : item.label}
          </DropdownMenuItem>
        ))}
        {onToggleTheme ? (
          <DropdownMenuItem
            icon={themeMode === "dark" ? "themeLight" : "themeDark"}
            onSelect={(event) => {
              event.preventDefault();
              onToggleTheme();
            }}
          >
            {themeMode === "dark" ? "Mode terang" : "Mode gelap"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon="logout" tone="danger" onSelect={onLogout}>Keluar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile bottom navigation. Items: { to, label, icon, end?, accent?, onClick? }. */
export function BottomNav({ items = [], label = "Navigasi cepat" }) {
  const location = useLocation();
  return (
    <nav className="aapm-bottom-nav" aria-label={label}>
      {items.map((item) => {
        const content = (
          <>
            <span className="aapm-bottom-nav__icon"><AapmIcon name={item.icon} /></span>
            <span className="aapm-bottom-nav__label">{item.label}</span>
          </>
        );
        if (item.onClick) {
          return (
            <button key={item.label} type="button" className="aapm-bottom-nav__item" data-accent={item.accent} onClick={item.onClick} aria-haspopup="dialog">
              {content}
            </button>
          );
        }
        const active = isItemActive(item, location.pathname);
        return (
          <NavLink key={item.to} to={item.to} end={item.end} className="aapm-bottom-nav__item" data-accent={item.accent} aria-current={active ? "page" : undefined}>
            {content}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Full navigation for phones, opened from the bottom bar or topbar. */
export function NavigationSheet({ open, onOpenChange, title = "Navigasi", children }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="aapm-nav-sheet" aria-describedby={undefined}>
        <SheetTitle className="aapm-visually-hidden">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Topbar: title area (breadcrumbs or page label) and actions. */
export function Topbar({ title, subtitle, breadcrumbs, actions, mobileBrandTo = "/" }) {
  return (
    <header className="aapm-topbar">
      <Link to={mobileBrandTo} className="aapm-topbar__mobile-brand" aria-label="Beranda">
        <AppBrand variant="icon" className="h-[30px] w-[30px]" />
      </Link>
      <div className="aapm-topbar__title">
        {breadcrumbs}
        {title ? <p className="aapm-topbar__title-text">{title}</p> : null}
        {subtitle ? <span className="aapm-text-caption">{subtitle}</span> : null}
      </div>
      <div className="aapm-topbar__actions">{actions}</div>
    </header>
  );
}

/**
 * Focus shell for the lesson player and assessments: a slim course bar,
 * optional outline, a single scrolling stage and a persistent action bar.
 * `footerTone` ("success" | "danger") turns the action bar into the
 * answer-feedback bar after a quiz check.
 */
export const FocusShell = React.forwardRef(function FocusShell(
  { bar, outline, outlineOpen = true, footer, footerTone, children, className, label = "Konten belajar", resetKey },
  ref,
) {
  const mainRef = React.useRef(null);
  React.useImperativeHandle(ref, () => mainRef.current);
  useResetScroll(mainRef, resetKey);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.shell = "focus";
    return () => { delete root.dataset.shell; };
  }, []);

  return (
    <div className={cn("aapm-focus", className)} data-outline={outline && outlineOpen ? "true" : "false"}>
      <a className="aapm-skip-link" href="#aapm-focus-main">Lewati ke konten</a>
      {bar}
      <div className="aapm-focus__body">
        {outline ? <aside className="aapm-focus__outline" aria-label="Kurikulum">{outline}</aside> : null}
        <main id="aapm-focus-main" ref={mainRef} tabIndex={-1} className="aapm-focus__main" aria-label={label}>
          {children}
        </main>
      </div>
      {footer ? <div className="aapm-focus__footer" data-tone={footerTone || undefined}>{footer}</div> : null}
    </div>
  );
});
