/**
 * AbstractBackdrop — large, low-contrast angular planes behind page content,
 * in the spirit of abstract.com (tone-on-tone faceted "folds").
 *
 * Anchored to the TOP and capped at one viewport tall (not the full document
 * height) so the SVG keeps a landscape aspect ratio and `slice` never
 * over-zooms the composition out of view on long pages (e.g. /knowledge).
 * It fades into the page base toward the bottom via a mask.
 *
 * Tints come from tokens (`--bg-secondary` is one step lighter than
 * `--bg-primary` in BOTH light and dark), so the facets read as a subtle
 * lighter geometry on either theme. Static, decorative, pointer-events-none,
 * sits behind content (z-0).
 */
export function AbstractBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
      style={{
        height: "100vh",
        zIndex: 0,
        maskImage: "linear-gradient(to bottom, #000 50%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 50%, transparent 100%)",
      }}
    >
      <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        {/* lighter planes (one step up from the page base) */}
        <g style={{ color: "var(--bg-secondary)" }}>
          {/* top-left corner fold */}
          <polygon points="0,0 560,0 0,520" fill="currentColor" opacity="0.7" />
          {/* top-right corner fold */}
          <polygon points="1440,0 1010,0 1440,330" fill="currentColor" opacity="0.55" />
          {/* dominant diagonal band — the central "fold" */}
          <polygon points="330,900 980,250 1210,400 690,900" fill="currentColor" opacity="0.55" />
          {/* bottom-left facet */}
          <polygon points="0,600 410,900 0,900" fill="currentColor" opacity="0.45" />
        </g>
        {/* one quieter facet for depth */}
        <polygon points="980,250 1440,560 1440,330" fill="var(--border-color)" opacity="0.35" />
      </svg>
    </div>
  );
}
