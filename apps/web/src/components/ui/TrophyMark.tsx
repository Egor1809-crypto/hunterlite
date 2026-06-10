/**
 * TrophyMark — solid championship trophy. Uses an EXPLICIT `fill: var(--primary)`
 * (not `currentColor`/inheritance) so it always renders in the theme accent —
 * purple in light, blue in dark — and never inherits a parent's white text colour
 * (which made the lucide outline invisible on the white circle).
 */
export function TrophyMark({ size = 24, color = "var(--primary)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.347 6.707 6.707 0 0 1-1.112 3.173H9.539c-1.035 0-1.875.84-1.875 1.875V19.5H6.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.914v-2.625c0-1.035-.84-1.875-1.875-1.875h-.762a6.707 6.707 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744ZM4.5 5.249v.255c0 1.176.464 2.243 1.219 3.027a5.265 5.265 0 0 1-2.62-2.93 45.6 45.6 0 0 1 1.401-.352Zm15 0c.469.114.935.232 1.401.352a5.265 5.265 0 0 1-2.62 2.93 4.302 4.302 0 0 0 1.219-3.027v-.255Z" />
    </svg>
  );
}
