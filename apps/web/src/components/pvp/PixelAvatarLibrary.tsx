"use client";

/**
 * Stub replacement for the deleted pixel-avatar sprite library.
 * Exports the same shapes so consuming components compile.
 */

export type PixelAvatarCode =
  | "operator" | "grandma" | "businessman" | "student"
  | "skeptic" | "aggressive" | "anxious" | "manipulator"
  | "silent" | "chatty" | "bot" | "judge";

interface PixelPortraitProps {
  code: PixelAvatarCode;
  tier?: string;
  size?: number;
  className?: string;
}

export function PixelPortrait({ code, size = 48, className }: PixelPortraitProps) {
  const initials = code.slice(0, 2).toUpperCase();
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "var(--accent-muted)",
        border: "2px solid var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.35,
        color: "var(--accent)",
      }}
      title={code}
    >
      {initials}
    </div>
  );
}

/** Returns a default avatar code based on player level */
export function usePlayerAvatar(_level: number): PixelAvatarCode {
  return "operator";
}

/** Returns a default avatar code for opponents */
export function resolveOpponentAvatar(
  _opponentName?: string | null,
  _opponentLevel?: number | null,
): PixelAvatarCode {
  return "grandma";
}
