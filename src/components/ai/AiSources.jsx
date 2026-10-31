import React from "react";
import { Ic } from "@/design-system/canvas";

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The web pages an answer used, read from the provider's citations, not from the text. */
export default function AiSources({ sources = [] }) {
  if (!sources.length) return null;
  return (
    <section className="aapm-ai-sources" aria-label="Sumber web">
      <span className="t-caption t-muted">Sumber web</span>
      <ol className="aapm-ai-sources__list">
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title || source.url}>
              <Ic name="link" size="xs" />
              <span className="t-clamp-1">{source.title || hostOf(source.url)}</span>
              <span className="sr-only"> (tab baru)</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
