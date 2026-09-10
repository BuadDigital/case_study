"use client";

import { useBrandLogos } from "@platform/app-shared/organization/brand-logos";
import { EjadaLogo } from "./EjadaLogo";

/**
 * The organization logo from «الهوية البصرية»: the uploaded white logo on dark surfaces and
 * the colored one on light surfaces, falling back to the built-in Ejadah mark.
 */
export function BrandLogo({
  className,
  variant = "onDark",
}: {
  className?: string;
  variant?: "onDark" | "onLight";
}) {
  const logos = useBrandLogos();
  const url = variant === "onLight" ? logos.color : logos.white;
  if (!url) return <EjadaLogo className={className} variant={variant} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL from settings, not a static asset
    <img
      src={url}
      alt="شعار المنشأة"
      className={`max-h-16 object-contain ${className ?? ""}`}
    />
  );
}
