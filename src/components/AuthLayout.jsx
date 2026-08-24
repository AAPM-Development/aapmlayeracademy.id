import React, { useEffect, useRef, useState } from "react";
import AppBrand from "@/components/AppBrand";
import AapmIcon from "@/components/icons/AapmIcon";

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
    }, 10000);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <aside className="relative hidden min-h-[100svh] overflow-hidden bg-brand-green lg:block">
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
      <div className="absolute inset-0 bg-gradient-to-t from-brand-foreground/80 via-brand-foreground/25 to-transparent" />
      <div className="absolute inset-x-0 top-[30%] flex justify-center px-10">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-foreground/50 blur-3xl"
          aria-hidden="true"
        />
        <AppBrand
          product="aapm"
          variant="icon"
          mode="dark"
          className="relative z-10 h-24 w-auto drop-shadow-[0_6px_20px_rgba(0,0,0,0.76)] xl:h-28"
          alt="AAPM"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-8 pb-10 xl:pb-12">
        <div
          key={insightIndex}
          className="academy-insight flex max-w-xl flex-col items-center text-center"
          aria-live="polite"
        >
          <p className="font-serif text-lg font-medium italic leading-7 text-white/95 drop-shadow-[0_3px_24px_rgba(0,0,0,0.55)] sm:text-xl sm:leading-8 xl:text-[1.35rem] xl:leading-8">“{academyInsights[insightIndex]}”</p>
          <AppBrand mode="dark" className="mt-5 h-7 w-auto max-w-[156px] opacity-90 drop-shadow-[0_3px_12px_rgba(0,0,0,0.56)]" alt="AAPM Layer Academy" />
        </div>
      </div>
    </aside>
  );
}

/** @param {any} props */
function DefaultAuthLayout(props) {
  const { title, subtitle, footer, children, iconName = null } = props;
  return (
    <div className="auth-ambient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-7 flex justify-center">
            <AppBrand className="h-12 w-auto max-w-[220px]" />
          </div>
          {iconName && <div className="mb-5 flex justify-center"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-tint-green text-tint-green-foreground"><AapmIcon name={iconName} className="h-6 w-6" /></div></div>}
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
      <main className="auth-pane relative flex min-h-[100svh] min-w-0 items-center justify-center overflow-y-auto px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex justify-center">
            <AppBrand
              product="aapm"
              variant="main"
              className="h-24 w-auto max-w-[160px] drop-shadow-[0_12px_24px_hsl(var(--aapm-green-700)_/_0.12)]"
              alt="AAPM Layer Academy"
            />
          </div>
          <div className="mb-8 text-center sm:text-left">
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
