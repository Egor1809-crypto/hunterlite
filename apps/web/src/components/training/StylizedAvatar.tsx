"use client";

import { User } from "lucide-react";

/**
 * Editorial avatar (replaces the deleted 3D "stylized" component).
 * Clean token-only avatar with an optional initial; no color blobs,
 * no gradient glow, no neon ring. Thin 1px var(--border-color) ring,
 * softening to var(--accent-muted) while speaking. Accepts all original
 * props for compat.
 */
export function StylizedAvatar({
  size = 120,
  className,
  style,
  isSpeaking,
  seed,
}: {
  emotion?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  isSpeaking?: boolean;
  audioLevel?: number;
  seed?: string;
  [key: string]: unknown;
}) {
  const initial =
    typeof seed === "string" && seed.trim().length > 0
      ? seed.trim()[0].toUpperCase()
      : null;

  return (
    <div
      className={`rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--bg-secondary)",
        border: `1px solid ${isSpeaking ? "var(--accent-muted)" : "var(--border-color)"}`,
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
        fontSize: size * 0.34,
        transition: "border-color 0.3s ease",
        ...style,
      }}
    >
      {initial ?? <User size={size * 0.4} strokeWidth={1.5} />}
    </div>
  );
}
