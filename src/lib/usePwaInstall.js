import { useCallback, useEffect, useState } from "react";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
      /** @type {any} */ (window.navigator)?.standalone,
  );
}

/**
 * Keep the browser install prompt behind a small product-facing hook. The
 * browser owns the actual prompt; the profile surface only decides when to
 * offer it and never attempts to fake an install state.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    const handleDisplayModeChange = () => setIsInstalled(isStandaloneDisplay());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" };
    // The install event is the browser-owned confirmation surface. Calling
    // it through the captured event is the only supported way to open the
    // native PWA install affordance; no product dialog is being fabricated.
    await deferredPrompt["prompt"]();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice?.outcome === "accepted") setIsInstalled(true);
    return choice;
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    install,
  };
}
