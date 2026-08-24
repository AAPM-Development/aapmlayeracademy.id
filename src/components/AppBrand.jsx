import React from "react";

export default function AppBrand({ className = "h-12 w-auto", ...props }) {
  return (
    <img
      src="/assets/Logo_AAPM_Main.svg"
      alt="AAPM Layer Academy"
      className={className}
      {...props}
    />
  );
}
