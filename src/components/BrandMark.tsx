import React from "react";
import { BRAND_APP_ICON_URL, BRAND_LOGO_URL } from "../lib/brand";

type Size = "sm" | "md" | "lg" | "xl";

const LOGO_SIZE: Record<Size, string> = {
  sm: "h-7 w-auto",
  md: "h-9 w-auto",
  lg: "h-11 w-auto",
  xl: "h-14 w-auto",
};

const ICON_SIZE: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

/** Full wordmark / logo used in headers and footers. */
export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <img
      src={BRAND_LOGO_URL}
      alt="MalluCupid"
      className={`${LOGO_SIZE[size]} object-contain ${className}`}
      draggable={false}
    />
  );
}

/** Square app icon used in compact chrome (mobile header, sidebar mark). */
export function BrandIcon({
  size = "md",
  className = "",
  rounded = "rounded-xl",
}: {
  size?: Size;
  className?: string;
  rounded?: string;
}) {
  return (
    <img
      src={BRAND_APP_ICON_URL}
      alt="MalluCupid"
      className={`${ICON_SIZE[size]} ${rounded} object-cover shrink-0 ${className}`}
      draggable={false}
    />
  );
}
