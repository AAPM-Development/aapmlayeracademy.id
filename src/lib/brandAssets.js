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
      light: "/brand/aapm/Logo_AAPM_Main.svg",
      dark: "/brand/aapm/Logo_AAPM_Main_Dark_Mode.svg",
    }),
    icon: Object.freeze({
      light: "/brand/aapm/Icon_AAPM.svg",
      dark: "/brand/aapm/Icon_AAPM_dark_mode.svg",
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
