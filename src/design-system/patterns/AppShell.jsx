import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import ProfileAvatar from "@/components/ProfileAvatar";
import { appiAsset } from "@/components/appi/AppiMascot";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import { cn } from "@/lib/utils";
import { Ic, Logo } from "../canvas";
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
import { StateView } from "../components/display";

// Redesign v2 shells (canvas "Shell — anatomi baru"): learner and admin share
// one frame — side + main with topbar, m-top and m-nav under 860 px — and
// the focus shell carries lesson, quiz, exam and the module editor.

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
 * App frame: sidebar, topbar (m-top on phones), one scrolling canvas, the
 * floating bottom nav on phones and the APPI launcher. `tone="calm"` is the
 * admin voice: 1 px lines, 3 px ledges, no decorative motion.
 */
export function AppShell({ sidebar, topbar, mobileTop, bottomNav, launcher, tone, collapsed = false, children, className, mainLabel = "Konten" }) {
  const location = useLocation();
  const mainRef = React.useRef(null);
  const scrollFadeRef = useScrollEdgeFade({ stateRef: mainRef });
  const setMainRef = React.useCallback((node) => {
    mainRef.current = node;
    scrollFadeRef(node);
  }, [scrollFadeRef]);
  useResetScroll(mainRef, location.pathname);
  const [pending, checkPending] = useRoutePending(location.pathname);

  return (
    <div
      className={cn("app", tone && "aapm", className)}
      data-tone={tone}
      data-collapsed={collapsed ? "true" : "false"}
      data-bottom-nav={bottomNav ? "true" : undefined}
      onClickCapture={checkPending}
    >
      <a className="aapm-skip-link" href="#aapm-main">Lewati ke konten</a>
      {sidebar}
      <div className="main">
        <div className="aapm-route-progress" data-active={pending ? "true" : undefined} aria-hidden="true" />
        {topbar}
        {mobileTop}
        <main id="aapm-main" ref={setMainRef} tabIndex={-1} className="main-scroll" aria-label={mainLabel} aria-busy={pending || undefined}>
          {/* The chrome paints at once on a hard load; only the canvas waits
              for the first route chunk. */}
          <React.Suspense fallback={<StateView kind="loading" title="Menyiapkan halaman…" framed={false} />}>
            {children}
          </React.Suspense>
        </main>
      </div>
      {launcher}
      {bottomNav}
    </div>
  );
}

/** Route page container (`.page`): 1280 max, 32 gutter, 24 section rhythm. */
export function Page({ width, flush, className, children, ...props }) {
  return (
    <div className={cn("page", width === "narrow" && "page-narrow", width === "wide" && "page-wide", flush && "page-flush", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Standalone status page for a visitor outside any shell (signed-out 404,
 * access denied, boot failure): the wordmark above one state card, centred.
 */
export function StatusPage({ children = null, className = undefined, ...card }) {
  return (
    <main className={cn("status-page", className)}>
      {card.title ? <StatusCard {...card} /> : (
        <div className="status-page-inner">
          <Logo variant="long" alt="AAPM Layer Academy" className="logo-lg" />
          {children}
        </div>
      )}
    </main>
  );
}

const STATUS_TONES = {
  info: { background: "var(--info-surface)", color: "var(--info-text)" },
  warning: { background: "var(--warning-surface)", color: "var(--warning-text)" },
  danger: { background: "var(--danger-surface)", color: "var(--danger-text)" },
  success: { background: "var(--success-surface)", color: "var(--success-text)" },
};

/** Status icon tile; its tone carries the meaning. */
export function StatusTile({ ic, tone = "info" }) {
  return <span className="tile tile-xl" style={STATUS_TONES[tone]} aria-hidden="true"><Ic name={ic} /></span>;
}

/**
 * Canvas system-page anatomy: logo, APPI or a status tile, title, a short
 * explanation, then a clear way out. `busy` centres the visual and title as
 * a live status (boot); `alert` announces a failure.
 */
export function StatusCard({ visual = null, title, text = null, meta = null, actions = null, busy = false, alert = false, titleAs: Title = "h1", className = undefined }) {
  return (
    <div className={cn("card card-pad-lg stack items-center t-center gap-5 status-card", className)}>
      <Logo variant="long" alt="AAPM .academy" style={{ height: 22, alignSelf: "center" }} />
      {busy ? (
        <div className="stack items-center justify-center gap-5 grow" role="status" aria-live="polite">
          {visual}
          <Title className="t-heading">{title}</Title>
        </div>
      ) : (
        <>
          <div className={alert ? "stack items-center justify-center gap-5 grow" : "row justify-center"} style={alert ? undefined : { height: 64 }}>
            {visual}
            {alert ? (
              <div className="stack items-center gap-2" role="alert">
                <Title className="t-title-c">{title}</Title>
                {text ? <p className="t-body t-muted t-pretty">{text}</p> : null}
              </div>
            ) : null}
          </div>
          {!alert ? (
            <div className="stack items-center gap-2">
              <Title className="t-title-c">{title}</Title>
              {text ? <p className="t-body t-muted t-pretty">{text}</p> : null}
              {meta}
            </div>
          ) : null}
        </>
      )}
      {actions ? <div className={cn("stack gap-3 w-full", !alert && "mt-auto")}>{actions}</div> : null}
    </div>
  );
}

function isItemActive(item, pathname) {
  if (item.match) return item.match(pathname);
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavIcon({ item }) {
  return item.ic ? <Ic name={item.ic} /> : <AapmIcon name={item.icon} />;
}

/** Grouped navigation. Items: { to, label, ic?, icon?, end?, accent?, badge?, match? }. */
export function SidebarNav({ groups = [], collapsed = false, onNavigate, onPreload, label = "Navigasi" }) {
  const location = useLocation();
  return (
    <nav className="stack gap-5" aria-label={label}>
      {groups.map((group) => (
        <div key={group.label || group.items?.[0]?.to || "group"} className="nav-group" role={group.label ? "group" : undefined} aria-label={group.label || undefined}>
          {group.label ? <span className="nav-label" aria-hidden="true">{group.label}</span> : null}
          {group.items.map((item) => {
            const active = isItemActive(item, location.pathname);
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn("nav-item", active && "is-active", item.accent === "ai" && "is-ai")}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                onClick={onNavigate}
                onMouseEnter={() => onPreload?.(item.to)}
                onFocus={() => onPreload?.(item.to)}
              >
                <NavIcon item={item} />
                <span className="nav-text">{item.label}</span>
                {item.badge ? <span className="count">{item.badge}</span> : null}
              </NavLink>
            );
            return collapsed ? <Tooltip key={item.to} content={item.label} side="right">{link}</Tooltip> : link;
          })}
        </div>
      ))}
    </nav>
  );
}

/** Sidebar (`.side`): brand row (logo + collapse), context card, grouped nav, footer. */
export function Sidebar({ brandTo = "/", brandLabel = "Beranda", collapsed = false, onToggle, context, children, footer, label = "Navigasi utama" }) {
  return (
    <aside className="side" data-collapsed={collapsed ? "true" : undefined} aria-label={label}>
      <div className="side-brand">
        <Link to={brandTo} aria-label={brandLabel}>
          <Logo variant="long" />
        </Link>
        {onToggle ? (
          <Tooltip content={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} side="right">
            <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} aria-expanded={!collapsed} onClick={onToggle}>
              <Ic name="sidebar" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <div className="side-body">
        {context}
        {children}
      </div>
      {footer ? <div className="side-foot">{footer}</div> : null}
    </aside>
  );
}

/** Topbar account trigger + menu. `meta` adds the second line (role) for admin. */
export function AccountMenu({ user, context, meta, items = [], onLogout, themeMode, onToggleTheme, compact = false }) {
  const displayName = user?.full_name || user?.email || "Peserta";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="topbar-account" aria-label={`Menu akun ${displayName}`}>
          <ProfileAvatar user={user} name={displayName} className="avatar avatar-sm" />
          {compact ? null : meta ? (
            <span className="stack items-start hide-sm" style={{ minWidth: 0 }}>
              <span className="t-support t-medium t-clamp-1">{displayName}</span>
              <span className="t-caption t-muted">{meta}</span>
            </span>
          ) : (
            <span className="t-body t-medium t-clamp-1 hide-sm">{displayName}</span>
          )}
          {compact ? null : <Ic name="chev-down" size="sm" className="t-muted hide-sm" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-64">
        <div className="stack" style={{ padding: "6px 10px 8px" }}>
          <strong className="t-body t-strong t-clamp-1">{displayName}</strong>
          <span className="t-caption t-muted t-clamp-1">{context}</span>
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

/**
 * Floating phone navigation (`.m-nav`, under 860 px): five destinations with
 * APPI raised in the middle. Items: { to, label, ic?, icon?, end?, appi?, match?, onClick? }.
 */
export function BottomNav({ items = [], label = "Navigasi cepat" }) {
  const location = useLocation();
  return (
    <nav className="m-nav" aria-label={label}>
      {items.map((item) => {
        const active = !item.onClick && isItemActive(item, location.pathname);
        const content = item.appi ? (
          <>
            <span className="m-appi-btn" aria-hidden="true"><img src={appiAsset(1)} alt="" /></span>
            {item.label}
          </>
        ) : (
          <>
            <NavIcon item={item} />
            {item.label}
          </>
        );
        if (item.onClick) {
          return (
            <button key={item.label} type="button" className={cn(item.appi && "m-appi", item.expanded && "is-active")} onClick={item.onClick} aria-haspopup="dialog" aria-expanded={item.expanded}>
              {content}
            </button>
          );
        }
        return (
          <NavLink key={item.to} to={item.to} end={item.end} className={cn(item.appi && "m-appi", active && !item.appi && "is-active")} aria-current={active ? "page" : undefined}>
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

/** Command search trigger (`.cmd`) for the topbar: opens the palette, Ctrl K. */
export function CommandTrigger({ label, onOpen, width }) {
  return (
    <button type="button" className="cmd" onClick={onOpen} aria-haspopup="dialog" aria-keyshortcuts="Control+K" style={width ? { width } : undefined}>
      <Ic name="search" size="sm" />
      <span className="t-clamp-1">{label}</span>
      <span className="kbd">Ctrl K</span>
    </button>
  );
}

/** Topbar (`.topbar`, 60 px): breadcrumbs or search on the left, actions right. */
export function Topbar({ breadcrumbs, search, actions }) {
  return (
    <header className="topbar">
      {breadcrumbs}
      {search}
      <div className="row gap-2 ml-auto">{actions}</div>
    </header>
  );
}

/** Phone top bar (`.m-top`, 56 px): mark · page title · points · account. */
export function MobileTop({ title, brandTo = "/", actions }) {
  return (
    <header className="m-top">
      <Link to={brandTo} aria-label="Beranda" className="row" style={{ flex: "none" }}>
        <Logo variant="icon" style={{ width: 30, height: 30 }} />
      </Link>
      <span className="t-heading grow t-clamp-1">{title}</span>
      {actions}
    </header>
  );
}

/**
 * Focus shell (`.focus`) for lesson, quiz and exam: a focus bar, optional
 * outline, a single scrolling stage and a sticky action bar. `footerTone`
 * ("success" | "danger") turns the action bar into the answer-feedback bar.
 */
export const FocusShell = React.forwardRef(function FocusShell(
  { bar, outline, outlineLabel = "Kurikulum", outlineOpen = true, footer, footerTone, children, className, label = "Konten belajar", resetKey, hue },
  ref,
) {
  const mainRef = React.useRef(null);
  const footerRef = React.useRef(null);
  const scrollFadeRef = useScrollEdgeFade({ stateRef: mainRef });
  const setMainRef = React.useCallback((node) => {
    mainRef.current = node;
    scrollFadeRef(node);
  }, [scrollFadeRef]);
  React.useImperativeHandle(ref, () => mainRef.current);
  useResetScroll(mainRef, resetKey);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.shell = "focus";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const update = () => {
      root.style.setProperty("--aapm-focus-footer-height", `${footerRef.current?.getBoundingClientRect().height || 0}px`);
      window.dispatchEvent(new Event("aapm:footer-resize"));
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (footerRef.current) observer?.observe(footerRef.current);
    return () => {
      observer?.disconnect();
      delete root.dataset.shell;
      root.style.removeProperty("--aapm-focus-footer-height");
    };
  }, [Boolean(footer)]);

  return (
    <div className={cn("focus", className)} data-hue={hue} data-outline={outline && outlineOpen ? "true" : "false"}>
      <a className="aapm-skip-link" href="#aapm-focus-main">Lewati ke konten</a>
      {bar}
      <div className="focus-body">
        {outline && outlineOpen ? <nav className="lesson-outline" aria-label={outlineLabel}>{outline}</nav> : null}
        <main id="aapm-focus-main" ref={setMainRef} tabIndex={-1} className="focus-main" aria-label={label}>
          {children}
        </main>
      </div>
      {footer ? (
        <footer ref={footerRef} className={cn("focus-foot", footerTone === "success" && "is-success", footerTone === "danger" && "is-danger")} role={footerTone ? "status" : undefined}>
          {footer}
        </footer>
      ) : null}
    </div>
  );
});
