import { useMemo, type CSSProperties } from "react";

interface CubeConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  delay: number;
  duration: number;
  depth: number;
  glowSize: number;
  glowOpacity: number;
  opacityMin: number;
  opacityMax: number;
  dx1: number; dy1: number;
  dx2: number; dy2: number;
  dx3: number; dy3: number;
  blur: number;
  variant: "orange" | "violet";
  isHero: boolean;
  rotateDuration: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateCubes(): CubeConfig[] {
  const rand = seededRandom(42);
  const result: CubeConfig[] = [];

  const layers = [
    // Far background — medium, clearly visible
    { count: 5, sizeMin: 20, sizeMax: 35, opMin: 0.35, opMax: 0.65, glowOp: 0.25, blur: 0.4, durMin: 14, durMax: 20 },
    // Mid layer — large, prominent
    { count: 8, sizeMin: 36, sizeMax: 55, opMin: 0.45, opMax: 0.75, glowOp: 0.35, blur: 0, durMin: 9, durMax: 14 },
    // Foreground — very large, bold
    { count: 6, sizeMin: 56, sizeMax: 85, opMin: 0.5, opMax: 0.85, glowOp: 0.45, blur: 0, durMin: 8, durMax: 12 },
    // Hero cubes — massive, slow rotation, glass-like
    { count: 4, sizeMin: 100, sizeMax: 160, opMin: 0.25, opMax: 0.55, glowOp: 0.35, blur: 0, durMin: 18, durMax: 28 },
  ];

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const isHeroLayer = li === 3;

    for (let i = 0; i < layer.count; i++) {
      const baseSize = layer.sizeMin + rand() * (layer.sizeMax - layer.sizeMin);
      const drift = 6 + rand() * 14;

      // Add shape variety: some cubes are rectangular (aspect 1:1 to 1:1.8)
      const aspectRatio = isHeroLayer
        ? 1 + rand() * 0.6  // hero cubes: slight elongation
        : 1 + rand() * 0.8; // regular cubes: more variety
      const useWideOrTall = rand() > 0.5;
      const w = useWideOrTall ? Math.round(baseSize * aspectRatio) : Math.round(baseSize);
      const h = useWideOrTall ? Math.round(baseSize) : Math.round(baseSize * aspectRatio);

      // Larger depth for more volume — hero cubes get extra depth
      const depthMultiplier = isHeroLayer ? 0.28 : 0.45;
      const minDepth = isHeroLayer ? 18 : 10;
      const depth = Math.max(minDepth, Math.round(Math.min(w, h) * depthMultiplier));

      // Mix orange and violet variants
      const variant: "orange" | "violet" = rand() > 0.45 ? "orange" : "violet";

      result.push({
        left: rand() * 94 + 3,
        top: rand() * 92 + 4,
        width: w,
        height: h,
        rotation: Math.round(-50 + rand() * 100),
        delay: Math.round(rand() * 100) / 10,
        duration: layer.durMin + rand() * (layer.durMax - layer.durMin),
        depth,
        glowSize: Math.round(Math.max(w, h) * 0.8 + 12),
        glowOpacity: layer.glowOp,
        opacityMin: layer.opMin,
        opacityMax: layer.opMax,
        dx1: Math.round((rand() - 0.5) * drift * 2),
        dy1: Math.round((rand() - 0.5) * drift * 2),
        dx2: Math.round((rand() - 0.5) * drift * 2),
        dy2: Math.round((rand() - 0.5) * drift * 2),
        dx3: Math.round((rand() - 0.5) * drift * 1.4),
        dy3: Math.round((rand() - 0.5) * drift * 1.4),
        blur: layer.blur,
        variant,
        isHero: isHeroLayer,
        rotateDuration: 40 + rand() * 60,
      });
    }
  }
  return result;
}

const CUBES = generateCubes();

export function PixelBackground() {
  const elements = useMemo(() =>
    CUBES.map((c, i) => {
      const className = [
        "pixel-background__dot",
        `pixel-background__dot--${c.variant}`,
        c.isHero ? "pixel-background__dot--hero" : "",
      ].filter(Boolean).join(" ");

      return (
        <span
          key={i}
          className={className}
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: `${c.width}px`,
            height: `${c.height}px`,
            "--cube-depth": `${c.depth}px`,
            "--cube-glow-size": `${c.glowSize}px`,
            "--cube-glow-far": `${c.glowSize * 2}px`,
            "--cube-glow-opacity": c.glowOpacity,
            "--cube-opacity-min": c.opacityMin,
            "--cube-opacity-max": c.opacityMax,
            "--cube-blur": `${c.blur}px`,
            "--cube-duration": `${c.duration.toFixed(1)}s`,
            "--cube-dx1": `${c.dx1}px`,
            "--cube-dy1": `${c.dy1}px`,
            "--cube-dx2": `${c.dx2}px`,
            "--cube-dy2": `${c.dy2}px`,
            "--cube-dx3": `${c.dx3}px`,
            "--cube-dy3": `${c.dy3}px`,
            "--cube-base-rot": `${c.rotation}deg`,
            "--cube-rotate-duration": `${c.rotateDuration.toFixed(0)}s`,
            transform: `rotateX(58deg) rotateZ(${c.rotation}deg)`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration.toFixed(1)}s`,
          } as CSSProperties}
        />
      );
    }),
  []);

  return (
    <div className="pixel-background" aria-hidden="true">
      {elements}
    </div>
  );
}
