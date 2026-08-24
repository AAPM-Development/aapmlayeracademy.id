import React, { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
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
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "base",
          themeVariables: dark
            ? {
                primaryColor: "#1f7a3d",
                primaryTextColor: "#f8fafc",
                primaryBorderColor: "#4ade80",
                lineColor: "#94a3b8",
                secondaryColor: "#1e293b",
                tertiaryColor: "#172033",
              }
            : {
                primaryColor: "#eff9f1",
                primaryTextColor: "#173a25",
                primaryBorderColor: "#2f8545",
                lineColor: "#64748b",
                secondaryColor: "#fff5ef",
                tertiaryColor: "#fff",
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
