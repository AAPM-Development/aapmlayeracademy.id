export const DEFAULT_BRAND_PRODUCT = "classic";
export const DEFAULT_BRAND_VARIANT = "logo";

export const brandAssets = Object.freeze({
  classic: Object.freeze({
    logo: Object.freeze({
      light: "/assets/Logo_AAPM_Main.svg",
      dark: "/assets/Logo_AAPM_Main_Dark_Mode.svg",
    }),
    icon: Object.freeze({
      light: "/assets/Icon_AAPM.svg",
      dark: "/assets/Icon_AAPM_dark_mode.svg",
    }),
  }),
  academy: Object.freeze({
    logo: Object.freeze({
      light: "/brand/academy/logo.svg",
      dark: "/brand/academy/logo-dark.svg",
    }),
    icon: Object.freeze({
      light: "/brand/academy/icon.svg",
      dark: "/brand/academy/icon-dark.svg",
    }),
  }),
  aapm: Object.freeze({
    logo: Object.freeze({
      light: "/brand/aapm/logo.svg",
      dark: "/brand/aapm/logo-dark.svg",
    }),
    icon: Object.freeze({
      light: "/brand/aapm/icon.svg",
      dark: "/brand/aapm/icon-dark.svg",
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
