"use client";

import type { ReactNode } from "react";

/**
 * Stub replacement for the deleted ArenaBackground component.
 * Renders children with a simple gradient background.
 */
export function ArenaBackground({
  children,
  className,
}: {
  children?: ReactNode;
  tier?: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "radial-gradient(ellipse at 50% 20%, var(--accent-muted) 0%, transparent 60%)",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}
