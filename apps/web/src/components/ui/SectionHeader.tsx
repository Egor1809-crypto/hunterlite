"use client";

/**
 * SectionHeader — one shared header pattern across screens.
 *
 * Quiet classification code (malvah "SC_13©25" → "01 · ЦЕНТР") + a heading
 * sized by the type scale (t-section-title). Hierarchy by scale, not weight.
 * Optional right slot for a single metric or action.
 */

import type { ReactNode } from "react";

export interface SectionHeaderProps {
  /** eyebrow classification code, e.g. "01 · ЦЕНТР" */
  code?: string;
  title: string;
  description?: string;
  /** right-aligned slot (one metric or action — keep it single) */
  right?: ReactNode;
  className?: string;
}

export function SectionHeader({ code, title, description, right, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`.trim()}>
      <div className="min-w-0">
        {code && (
          <div
            className="font-mono uppercase tabular-nums"
            style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-secondary)" }}
          >
            {code}
          </div>
        )}
        <h2 className="t-section-title truncate" style={{ marginTop: code ? 6 : 0 }}>
          {title}
        </h2>
        {description && (
          <p className="t-caption" style={{ marginTop: 6 }}>
            {description}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
