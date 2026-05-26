"use client";

/**
 * Stub replacement for the deleted CrystalMic 3D component.
 * Renders a simple mic indicator. Accepts all original props for compat.
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
  return (
    <button
      type="button"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: isActive ? "var(--accent)" : "var(--input-bg)",
        border: `2px solid ${isActive ? "var(--accent)" : "var(--border-color)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        cursor: "pointer",
        ...style,
      }}
      onClick={onClick}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
    >
      <span style={{ fontSize: size * 0.4, color: isActive ? "#fff" : "var(--text-muted)" }}>🎤</span>
    </button>
  );
}
