import React, { useEffect, useRef, useState } from "react";
import AppBrand from "@/components/AppBrand";
import { IconTile } from "@/components/ui/icon-tile";

const academyInsights = [
  "Di balik hasil yang konsisten, ada keputusan kecil yang diamati, dicatat, dan dijalankan dengan disiplin.",
  "Performa farm yang sehat dimulai dari kemampuan membaca sinyal—pakan, air, telur, dan perilaku ayam.",
  "Belajar di AAPM berarti mengubah pengalaman kandang menjadi keputusan yang lebih presisi dan berdampak.",
];

function AcademyVideoPanel() {
  const videoRef = useRef(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);

    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      videoRef.current?.pause();
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setInsightIndex((current) => (current + 1) % academyInsights.length);
    }, 9000);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <aside className="relative hidden min-h-[100svh] overflow-hidden bg-[#10251c] lg:block">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/assets/Video-Web_3.mp4"
        autoPlay={!prefersReducedMotion}
        muted
        loop
        playsInline
        preload={prefersReducedMotion ? "none" : "metadata"}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07120d]/60 via-[#07120d]/15 to-transparent" />
      <div className="absolute inset-x-0 top-0 flex justify-center px-10 pt-6 xl:pt-8">
        <div
          className="pointer-events-none absolute inset-x-0 -top-1 h-28 bg-[radial-gradient(ellipse_at_top,rgba(7,18,13,0.58),rgba(7,18,13,0.18)_48%,transparent_78%)]"
          aria-hidden="true"
        />
        <AppBrand
          mode="dark"
          className="relative z-10 h-12 w-auto max-w-[180px] drop-shadow-[0_4px_18px_rgba(0,0,0,0.58)]"
          alt="AAPM Layer Academy"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-8 pb-12 xl:pb-16">
        <p
          key={insightIndex}
          className="academy-insight max-w-2xl text-center font-serif text-xl font-medium italic leading-7 text-white/95 drop-shadow-[0_3px_24px_rgba(0,0,0,0.55)] sm:text-2xl sm:leading-8 xl:text-[1.7rem] xl:leading-9"
          aria-live="polite"
        >
          “{academyInsights[insightIndex]}”
        </p>
      </div>
    </aside>
  );
}

/** @param {any} props */
function DefaultAuthLayout(props) {
  const { title, subtitle, footer, children, icon: PageIcon = null } = props;
  return (
    <div className="auth-ambient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-7 flex justify-center">
            <AppBrand className="h-12 w-auto max-w-[220px]" />
          </div>
          {PageIcon && <div className="mb-5 flex justify-center"><IconTile icon={PageIcon} tone="green" size="lg" /></div>}
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">{title}</h1>
          {subtitle && <p className="mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-card/95 p-6 shadow-[var(--card-shadow)] sm:p-8">
          {children}
        </div>
        {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}

/** @param {any} props */
function LoginAuthLayout(props) {
  const { title, subtitle, footer, children } = props;
  return (
    <div className="min-h-[100svh] bg-background lg:grid lg:grid-cols-[44%_56%]">
      <main className="auth-pane relative flex min-h-[100svh] min-w-0 items-center justify-center overflow-y-auto px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 flex justify-center">
            <AppBrand className="h-16 w-auto max-w-[260px]" />
          </div>
          <div className="mb-9">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-3 max-w-sm text-base leading-7 text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {footer}
            </p>
          )}
        </div>
      </main>
      <AcademyVideoPanel />
    </div>
  );
}

/** @type {any} */
const AuthLayout = ({ variant = "default", ...props } = {}) => {
  return variant === "login" ? <LoginAuthLayout {...props} /> : <DefaultAuthLayout {...props} />;
};

export default AuthLayout;
