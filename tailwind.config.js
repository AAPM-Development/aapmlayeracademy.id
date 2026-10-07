/** @type {import('tailwindcss').Config} */
// Tailwind is the layout utility layer. Colours, type, radius, depth and
// motion resolve to the AAPM Academy tokens (src/design-system), so a
// utility class can never introduce a value outside the system.
const hsl = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const token = (name) => `var(--aapm-${name})`;
const hues = ["green", "orange", "blue", "violet", "teal", "amber", "rose"];

module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  corePlugins: {
    // The AAPM reset ships in the design-system layer (src/index.css) so
    // components are not overridden by Tailwind's element defaults.
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          green: hsl("brand-aapm-green"),
          lime: hsl("brand-aapm-lime"),
          orange: hsl("brand-aapm-orange"),
          foreground: hsl("brand-foreground"),
          "foreground-muted": hsl("brand-foreground-muted"),
        },
        background: hsl("background"),
        foreground: hsl("foreground"),
        surface: {
          DEFAULT: hsl("surface"),
          subtle: hsl("surface-subtle"),
          elevated: hsl("surface-elevated"),
          hover: hsl("surface-hover"),
          inset: hsl("surface-inset"),
        },
        tint: Object.fromEntries(
          ["green", "lime", "orange", "blue", "violet", "slate"].flatMap((tone) => [
            [tone, hsl(`tint-${tone}`)],
            [`${tone}-foreground`, hsl(`tint-${tone}-foreground`)],
            [`${tone}-border`, hsl(`tint-${tone}-border`)],
          ]),
        ),
        hue: Object.fromEntries(
          hues.flatMap((hue) => [
            [hue, token(`semantic-hue-${hue}`)],
            [`${hue}-soft`, token(`semantic-hue-${hue}-soft`)],
            [`${hue}-tint`, token(`semantic-hue-${hue}-tint`)],
            [`${hue}-ink`, token(`semantic-hue-${hue}-ink`)],
          ]),
        ),
        card: { DEFAULT: hsl("card"), foreground: hsl("card-foreground") },
        popover: { DEFAULT: hsl("popover"), foreground: hsl("popover-foreground") },
        primary: { DEFAULT: hsl("primary"), foreground: hsl("primary-foreground") },
        secondary: { DEFAULT: hsl("secondary"), foreground: hsl("secondary-foreground") },
        muted: { DEFAULT: hsl("muted"), foreground: hsl("muted-foreground") },
        accent: { DEFAULT: hsl("accent"), foreground: hsl("accent-foreground") },
        destructive: { DEFAULT: hsl("destructive"), foreground: hsl("destructive-foreground") },
        border: hsl("border"),
        input: hsl("input"),
        ring: hsl("ring"),
        success: hsl("success"),
        warning: hsl("warning"),
        danger: hsl("danger"),
        info: hsl("info"),
        attention: hsl("attention"),
        ai: { DEFAULT: hsl("ai"), foreground: hsl("ai-foreground") },
        learning: {
          active: hsl("learning-active"),
          complete: hsl("learning-complete"),
          locked: hsl("learning-locked"),
        },
        metric: {
          positive: hsl("metric-positive"),
          negative: hsl("metric-negative"),
          neutral: hsl("metric-neutral"),
        },
        chart: {
          1: hsl("chart-1"),
          2: hsl("chart-2"),
          3: hsl("chart-3"),
          4: hsl("chart-4"),
          5: hsl("chart-5"),
        },
        sidebar: {
          DEFAULT: hsl("sidebar-background"),
          foreground: hsl("sidebar-foreground"),
          primary: hsl("sidebar-primary"),
          "primary-foreground": hsl("sidebar-primary-foreground"),
          accent: hsl("sidebar-accent"),
          "accent-foreground": hsl("sidebar-accent-foreground"),
          border: hsl("sidebar-border"),
          ring: hsl("sidebar-ring"),
        },
      },
      fontFamily: {
        sans: [token("primitive-font-ui")],
        heading: [token("primitive-font-ui")],
        body: [token("primitive-font-ui")],
        display: [token("primitive-font-ui")],
        mono: [token("primitive-font-mono")],
      },
      fontSize: {
        overline: [token("component-type-overline-size"), { lineHeight: token("component-type-overline-line") }],
        caption: [token("component-type-caption-size"), { lineHeight: token("component-type-caption-line") }],
        support: [token("component-type-support-size"), { lineHeight: token("component-type-support-line") }],
        body: [token("component-type-body-size"), { lineHeight: token("component-type-body-line") }],
        heading: [token("component-type-heading-size"), { lineHeight: token("component-type-heading-line") }],
        section: [token("component-type-section-size"), { lineHeight: token("component-type-section-line") }],
        "title-compact": [token("component-type-title-compact-size"), { lineHeight: token("component-type-title-compact-line") }],
        title: [token("component-type-title-size"), { lineHeight: token("component-type-title-line") }],
        display: [token("component-type-display-size"), { lineHeight: token("component-type-display-line") }],
        metric: [token("component-type-metric-size"), { lineHeight: token("component-type-metric-line") }],
      },
      borderRadius: {
        xs: token("primitive-radius-xs"),
        sm: token("primitive-radius-small"),
        DEFAULT: token("primitive-radius-control"),
        md: token("primitive-radius-control"),
        lg: token("primitive-radius-panel"),
        xl: token("primitive-radius-panel"),
        "2xl": token("primitive-radius-surface"),
        "3xl": token("primitive-radius-feature"),
        control: token("primitive-radius-control"),
        panel: token("primitive-radius-panel"),
        surface: token("primitive-radius-surface"),
        feature: token("primitive-radius-feature"),
      },
      boxShadow: {
        rest: token("semantic-shadow-rest"),
        card: token("semantic-shadow-card"),
        raised: token("semantic-shadow-raised"),
        overlay: token("semantic-shadow-overlay"),
      },
      zIndex: {
        sticky: token("primitive-layer-sticky"),
        header: token("primitive-layer-header"),
        floating: token("primitive-layer-floating"),
        dropdown: token("primitive-layer-dropdown"),
        overlay: token("primitive-layer-overlay"),
        toast: token("primitive-layer-toast"),
      },
      spacing: {
        header: token("primitive-header-height"),
        sidebar: token("primitive-sidebar-width"),
        "bottom-nav": token("primitive-bottom-nav-height"),
      },
      maxWidth: {
        content: token("primitive-content-max"),
        wide: token("primitive-content-wide"),
        narrow: token("primitive-content-narrow"),
        reading: token("primitive-reading-measure"),
      },
      transitionTimingFunction: {
        aapm: token("primitive-motion-ease"),
      },
      transitionDuration: {
        fast: token("primitive-motion-fast"),
        base: token("primitive-motion-base"),
        panel: token("primitive-motion-panel"),
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
