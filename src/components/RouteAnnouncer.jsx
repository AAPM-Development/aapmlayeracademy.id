import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const BRAND = "AAPM Layer Academy";
// Long enough for a route's data to bring in its heading; the observer stops after this.
const WATCH_MS = 6000;
const QUIET_MS = 120;

function pageHeading() {
  const heading = document.querySelector("main h1");
  if (!heading || heading.closest('[role="status"]')) return "";
  return heading.textContent.replace(/\s+/g, " ").trim();
}

function focusContent() {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
  const main = document.querySelector("main[tabindex]");
  if (!main || main.contains(document.activeElement)) return;
  main.focus({ preventScroll: true });
}

/**
 * A single-page app keeps one document, so neither the browser tab nor a screen reader
 * learns that the page changed. Once a route has rendered its heading, this names the
 * tab, announces the page, and moves focus to the content so the next Tab starts there.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const isFirstRoute = useRef(true);

  useEffect(() => {
    const announce = !isFirstRoute.current;
    isFirstRoute.current = false;
    let announced = false;
    let quiet = 0;

    const settle = () => {
      const heading = pageHeading();
      if (!heading) return;
      document.title = `${heading} · ${BRAND}`;
      if (!announce || announced) return;
      announced = true;
      setMessage(heading);
      focusContent();
    };
    const schedule = () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(settle, QUIET_MS);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById("root"), { childList: true, subtree: true, characterData: true });
    const stop = window.setTimeout(() => observer.disconnect(), WATCH_MS);
    schedule();

    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
      window.clearTimeout(quiet);
    };
  }, [pathname]);

  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>;
}
