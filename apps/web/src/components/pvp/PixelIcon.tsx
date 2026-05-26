"use client";

export type PixelIconName = string;

interface PixelIconProps {
  name: PixelIconName;
  size?: number;
  color?: string;
  className?: string;
}

const EMOJI_MAP: Record<string, string> = {
  sword: "⚔",
  skull: "☠",
  bolt: "⚡",
  robot: "🤖",
  target: "🎯",
  shield: "🛡",
  star: "⭐",
  heart: "❤",
  fire: "🔥",
  book: "📖",
  crown: "👑",
  check: "✔",
  eye: "👁",
  brain: "🧠",
  ladder: "🪜",
  castle: "🏰",
  pointer: "👆",
  timeline: "📅",
  court: "⚖",
  property: "🏠",
  documents: "📄",
  rights: "✊",
  costs: "💰",
  consequences: "⚠",
  wait: "⏳",
  creditors: "🏦",
};

/**
 * Stub replacement for the deleted pixel-art icon component.
 * Renders an emoji or the first letter of the icon name.
 */
export function PixelIcon({ name, size = 16, color = "currentColor", className }: PixelIconProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        fontSize: size * 0.6,
        fontWeight: 700,
        color,
        lineHeight: 1,
      }}
      aria-hidden
      title={name}
    >
      {EMOJI_MAP[name] ?? name.charAt(0).toUpperCase()}
    </span>
  );
}
