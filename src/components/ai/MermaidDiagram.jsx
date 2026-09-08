import React, { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function themeColor(token, fallback) {
  const tokenOwner =
    document.querySelector(".aapm-t7-runtime") || document.documentElement;
  const value = getComputedStyle(tokenOwner).getPropertyValue(token).trim();
  return value ? `hsl(${value})` : fallback;
}

export default function MermaidDiagram({ chart }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [dark, setDark] = useState(() => isDarkMode());

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        // Mermaid owns the SVG markup, but its visual language should still
        // come from the same Ten4Seven chart/surface roles as KPI and LineChart.
        // Reading the resolved variables also keeps dark mode and palette
        // changes in lockstep with the rest of the app.
        const chartOne = themeColor("--t7-chart-1-hsl", "148 58% 29%");
        const chartTwo = themeColor("--t7-chart-2-hsl", "193 74% 36%");
        const chartThree = themeColor("--t7-chart-3-hsl", "30 90% 42%");
        const foreground = themeColor("--t7-foreground-hsl", dark ? "0 0% 96%" : "0 0% 12%");
        const border = themeColor("--t7-border-hsl", dark ? "0 0% 24%" : "0 0% 86%");
        const surface = themeColor("--t7-surface-hsl", dark ? "0 0% 12%" : "0 0% 100%");
        const surfaceSubtle = themeColor("--t7-surface-subtle-hsl", dark ? "0 0% 16%" : "0 0% 97%");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "base",
          themeVariables: dark
            ? {
                primaryColor: surfaceSubtle,
                primaryTextColor: foreground,
                primaryBorderColor: chartOne,
                lineColor: border,
                secondaryColor: surface,
                tertiaryColor: chartTwo,
              }
            : {
                primaryColor: surfaceSubtle,
                primaryTextColor: foreground,
                primaryBorderColor: chartOne,
                lineColor: border,
                secondaryColor: surface,
                tertiaryColor: chartThree,
              },
        });
        const result = await mermaid.render(`appi-mermaid-${rawId}`, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setSvg("");
          setError("Diagram tidak dapat dirender.");
        }
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [chart, dark, rawId]);

  if (error)
    return (
      <pre className="aapm-ai-code-block">
        <code>{chart}</code>
      </pre>
    );
  if (!svg)
    return (
      <div className="aapm-ai-mermaid-loading" aria-label="Menyiapkan diagram">
        <span className="aapm-ai-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>Menyiapkan diagram…</span>
      </div>
    );

  return (
    <div
      className="aapm-ai-mermaid"
      role="img"
      aria-label="Diagram APPI"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
