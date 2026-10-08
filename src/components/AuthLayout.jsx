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
  const [isDesktop, setIsDesktop] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const updateMediaState = () => {
      setPrefersReducedMotion(motionQuery.matches);
      setIsDesktop(desktopQuery.matches);
    };

    updateMediaState();
    motionQuery.addEventListener?.("change", updateMediaState);
    desktopQuery.addEventListener?.("change", updateMediaState);

    return () => {
      motionQuery.removeEventListener?.("change", updateMediaState);
      desktopQuery.removeEventListener?.("change", updateMediaState);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      videoRef.current?.pause();
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isDesktop || prefersReducedMotion) {
      setShouldLoadVideo(false);
      return undefined;
    }

    const loadVideo = () => setShouldLoadVideo(true);

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(loadVideo, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(loadVideo, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [isDesktop, prefersReducedMotion]);

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
    <aside className="aapm-auth__media" aria-hidden="true">
      <video
        ref={videoRef}
        src={shouldLoadVideo ? "/assets/Video-Web_3.mp4" : undefined}
        poster="/assets/Video-Web_3-poster.webp"
        autoPlay={shouldLoadVideo && !prefersReducedMotion}
        muted
        loop
        playsInline
        preload={shouldLoadVideo ? "metadata" : "none"}
      />
      <blockquote key={insightIndex} className="aapm-auth__quote academy-insight">
        “{academyInsights[insightIndex]}”
        <footer>AAPM Layer Academy</footer>
      </blockquote>
    </aside>
  );
}

/**
 * Auth shell (AAPM Farm benchmark): calm form column, brand media panel.
 * Every auth route shares the same anatomy so sign-in, registration and
 * recovery feel like one flow.
 */
function AuthLayout({ title, subtitle, footer, children, iconName = null }) {
  return (
    <div className="aapm-auth">
      <main className="aapm-auth__pane">
        <div className="aapm-auth__form">
          <AppBrand product="aapm" variant="logo" className="aapm-auth__brand" alt="AAPM Layer Academy" />
          {iconName ? <span className="aapm-icon-tile mb-4" data-hue="orange" data-size="lg" data-shape="circle"><AapmIcon name={iconName} /></span> : null}
          <h1 className="aapm-auth__title">{title}</h1>
          {subtitle ? <p className="aapm-auth__subtitle">{subtitle}</p> : null}
          {children}
          {footer ? <p className="aapm-auth__footer">{footer}</p> : null}
        </div>
        <p className="aapm-auth__legal">© AAPM · Pelatihan profesional manajemen layer farm</p>
      </main>
      <AcademyVideoPanel />
    </div>
  );
}

export default AuthLayout;
