export const DEFAULT_BRAND_PRODUCT = "aapm";
export const DEFAULT_BRAND_VARIANT = "logo";

export const brandAssets = Object.freeze({
  academy: Object.freeze({
    logo: Object.freeze({
      light: "/brand/academy/Academy_Main_Logo_Long.svg",
      dark: "/brand/academy/Academy_Main_Logo_Long_For_Dark.svg",
    }),
    icon: Object.freeze({
      light: "/brand/academy/icon.svg",
      dark: "/brand/academy/icon-dark.svg",
    }),
  }),
  aapm: Object.freeze({
    logo: Object.freeze({
      light: "/brand/aapm/logo_long.svg",
      dark: "/brand/aapm/logo_long_dark.svg",
    }),
    main: Object.freeze({
      light: "/brand/aapm/logo_main.svg",
      dark: "/brand/aapm/logo_main_dark.svg",
    }),
    icon: Object.freeze({
      light: "/brand/aapm/logo_main.svg",
      dark: "/brand/aapm/logo_main_dark.svg",
    }),
  }),
});

function normalizeMode(mode) {
  return mode === "dark" ? "dark" : "light";
}

export function resolveBrandAsset({
  product = DEFAULT_BRAND_PRODUCT,
  variant = DEFAULT_BRAND_VARIANT,
  mode = "light",
} = {}) {
  const productAssets = brandAssets[product] ?? brandAssets[DEFAULT_BRAND_PRODUCT];
  const variantAssets = productAssets[variant] ?? productAssets[DEFAULT_BRAND_VARIANT];
  const resolvedMode = normalizeMode(mode);

  return variantAssets[resolvedMode] ?? variantAssets.light;
}
