"use client";

/**
 * Card — the canonical surface primitive (unifies glass-panel / lh-card /
 * cyber-card / ad-hoc rounded-2xl panels).
 *
 * Vibe system: token-based, hairline-only, one optional top-accent line.
 * No neon, no glow, no second accent. Works in light + dark via tokens.
 *
 * Variants:
 *   frameless   — no border/background/shadow; structure via whitespace.
 *   hairline    — 1px --border-color on --surface-card, --radius-2xl (default).
 *   interactive — hairline + subtle hover lift (border-hover + shadow-md).
 */

import { forwardRef } from "react";

export type CardVariant = "frameless" | "hairline" | "interactive";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** thin --primary line across the top edge (the single accent) */
  accentTop?: boolean;
  /** apply --space-card internal padding (default true) */
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "hairline", accentTop = false, padded = true, className = "", style, children, ...rest },
  ref,
) {
  const frameless = variant === "frameless";
  const base: React.CSSProperties = {
    position: "relative",
    borderRadius: frameless ? undefined : "var(--radius-2xl)",
    background: frameless ? "transparent" : "var(--surface-card)",
    border: frameless ? undefined : "1px solid var(--border-color)",
    padding: padded ? "var(--space-card)" : undefined,
    overflow: accentTop && !frameless ? "hidden" : undefined,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={`${variant === "interactive" ? "lh-card-interactive" : ""} ${className}`.trim()}
      style={base}
      {...rest}
    >
      {accentTop && !frameless && (
        <span
          aria-hidden
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--primary)" }}
        />
      )}
      {children}
    </div>
  );
});
