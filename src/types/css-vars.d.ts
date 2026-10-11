// Canvas styles pass CSS custom properties (--i, --p, --size, --hue …) inline.
import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
