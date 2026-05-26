"use client";

import { Compass } from "lucide-react";

/**
 * Stub replacement for the deleted CompassIcon component.
 * Renders a simple Compass icon from lucide-react.
 */
export function CompassIcon({
  size = 48,
  accentColor = "var(--accent)",
}: {
  size?: number;
  accentColor?: string;
  accentRgb?: string;
  oscillate?: boolean;
}) {
  return <Compass size={size} style={{ color: accentColor }} />;
}
