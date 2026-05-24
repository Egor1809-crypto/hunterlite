import { useMemo, type CSSProperties } from "react";

interface CubeConfig {
  left: number;
  top: number;
  size: number;
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
    { count: 8, sizeMin: 6, sizeMax: 12, opMin: 0.06, opMax: 0.2, glowOp: 0.08, blur: 0.6, durMin: 12, durMax: 18 },
    { count: 12, sizeMin: 14, sizeMax: 24, opMin: 0.1, opMax: 0.4, glowOp: 0.18, blur: 0.2, durMin: 8, durMax: 13 },
    { count: 10, sizeMin: 26, sizeMax: 40, opMin: 0.14, opMax: 0.52, glowOp: 0.28, blur: 0, durMin: 7, durMax: 11 },
    { count: 4, sizeMin: 42, sizeMax: 58, opMin: 0.08, opMax: 0.32, glowOp: 0.2, blur: 0, durMin: 10, durMax: 16 },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const size = layer.sizeMin + rand() * (layer.sizeMax - layer.sizeMin);
      const drift = 6 + rand() * 14;
      result.push({
        left: rand() * 96 + 2,
        top: rand() * 94 + 3,
        size: Math.round(size),
        rotation: Math.round(-50 + rand() * 100),
        delay: Math.round(rand() * 100) / 10,
        duration: layer.durMin + rand() * (layer.durMax - layer.durMin),
        depth: Math.max(6, Math.round(size * 0.38)),
        glowSize: Math.round(size * 0.8 + 10),
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
      });
    }
  }
  return result;
}

const CUBES = generateCubes();

export function PixelBackground() {
  const elements = useMemo(() =>
    CUBES.map((c, i) => (
      <span
        key={i}
        className="pixel-background__dot"
        style={{
          left: `${c.left}%`,
          top: `${c.top}%`,
          width: `${c.size}px`,
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
          transform: `rotateX(58deg) rotateZ(${c.rotation}deg)`,
          animationDelay: `${c.delay}s`,
          animationDuration: `${c.duration.toFixed(1)}s`,
        } as CSSProperties}
      />
    )),
  []);

  return (
    <div className="pixel-background" aria-hidden="true">
      {elements}
    </div>
  );
}
