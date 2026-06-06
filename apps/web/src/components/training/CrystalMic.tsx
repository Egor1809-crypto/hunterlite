"use client";

import { Mic } from "lucide-react";

/**
 * Editorial mic button (replaces the deleted 3D "crystal" component).
 * Calm, token-only round mic button. Accepts all original props for compat.
 * - idle/active: var(--accent-muted) / var(--accent)
 * - recording:   var(--danger-muted) / var(--danger)
 * - soft token pulse while recording, no neon glow, no gradients.
 */
export function CrystalMic({
  active,
  isRecording,
  size = 48,
  className,
  style,
  onClick,
  onPress,
  onRelease,
  disabled,
}: {
  active?: boolean;
  isRecording?: boolean;
  isProcessing?: boolean;
  size?: number;
  audioLevel?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onPress?: () => void;
  onRelease?: () => void;
  onTextMode?: () => void;
  disabled?: boolean;
  mode?: string;
  [key: string]: unknown;
}) {
  const isActive = active || isRecording;
  const iconSize = Math.round(size * 0.42);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isActive}
      className={`rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: isRecording
          ? "var(--danger-muted)"
          : isActive
            ? "var(--accent)"
            : "var(--accent-muted)",
        color: isRecording
          ? "var(--danger)"
          : isActive
            ? "var(--accent-contrast, #fff)"
            : "var(--accent)",
        border: `1px solid ${
          isRecording
            ? "var(--danger)"
            : isActive
              ? "var(--accent)"
              : "var(--border-color)"
        }`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
      onClick={onClick}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
    >
      <Mic
        size={iconSize}
        strokeWidth={1.75}
        className={isRecording ? "animate-pulse" : undefined}
      />
    </button>
  );
}
