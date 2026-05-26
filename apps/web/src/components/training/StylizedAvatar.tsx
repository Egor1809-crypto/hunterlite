"use client";

/**
 * Stub replacement for the deleted StylizedAvatar 3D component.
 * Renders a simple avatar placeholder. Accepts all original props for compat.
 */
export function StylizedAvatar({
  size = 120,
  className,
  style,
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
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--accent-muted)",
        border: "2px solid var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        ...style,
      }}
    >
      🗣
    </div>
  );
}
