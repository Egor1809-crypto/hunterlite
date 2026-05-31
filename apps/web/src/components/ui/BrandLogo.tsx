"use client";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const wordmarkSize = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

const compactSize = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-base",
};

export function BrandLogo({ compact = false, size = "md", className }: BrandLogoProps) {
  if (compact) {
    return (
      <span
        className={cn(
          "brand-logo-mark flex shrink-0 items-center justify-center rounded-2xl font-bold",
          compactSize[size],
          className,
        )}
        aria-label="LegalHunter"
      >
        LH
      </span>
    );
  }

  return (
    <span
      className={cn(
        "brand-logo-wordmark whitespace-nowrap font-semibold tracking-normal",
        wordmarkSize[size],
        className,
      )}
      aria-label="LegalHunter"
    >
      <span className="brand-logo-legal">Legal</span>
      <span className="brand-logo-hunter">Hunter</span>
    </span>
  );
}
