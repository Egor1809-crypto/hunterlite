"use client";

/**
 * Stub replacement for the deleted PixelMascot sprite component.
 * Renders a simple emoji placeholder. Accepts all original props for compat.
 */
export function PixelMascot({
  state = "idle",
  size = 48,
}: {
  state?: string;
  size?: number;
  className?: string;
  background?: string;
  ariaLabel?: string;
  bordered?: boolean;
  frameColor?: string;
  onClick?: () => void;
  [key: string]: unknown;
}) {
  const emoji = state === "cheer" ? "🎉" : state === "sad" ? "😿" : state === "think" ? "🤔" : "🦁";
  return (
    <span
      style={{
        fontSize: size * 0.6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}
