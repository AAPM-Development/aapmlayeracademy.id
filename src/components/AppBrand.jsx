import React, { useEffect, useState } from "react";
import {
  DEFAULT_BRAND_PRODUCT,
  DEFAULT_BRAND_VARIANT,
  resolveBrandAsset,
} from "../lib/brandAssets";

function getDocumentThemeMode() {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export default function AppBrand({
  className = "h-12 w-auto",
  product = DEFAULT_BRAND_PRODUCT,
  variant = DEFAULT_BRAND_VARIANT,
  mode = undefined,
  alt = undefined,
  ...props
}) {
  const [resolvedMode, setResolvedMode] = useState(mode ?? getDocumentThemeMode);

  useEffect(() => {
    if (mode) {
      setResolvedMode(mode);
      return undefined;
    }

    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const updateMode = () => setResolvedMode(getDocumentThemeMode());

    updateMode();

    if (typeof MutationObserver === "undefined") {
      return undefined;
    }

    const observer = new MutationObserver(updateMode);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [mode]);

  const src = resolveBrandAsset({ product, variant, mode: resolvedMode });
  const defaultAlt = product === "aapm" ? "AAPM" : "AAPM Layer Academy";

  return (
    <img
      {...props}
      src={src}
      alt={alt ?? defaultAlt}
      className={className}
    />
  );
}
