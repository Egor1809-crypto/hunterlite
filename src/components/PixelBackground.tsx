const cubes = [
  [7, 6, 18, -18, 0.2, 8.8],
  [22, 4, 11, 24, 2.4, 7.6],
  [41, 9, 24, -36, 4.1, 10.2],
  [69, 3, 13, 14, 1.3, 8.4],
  [88, 12, 20, -8, 5.6, 9.6],
  [12, 24, 12, 31, 3.1, 7.9],
  [33, 19, 28, -22, 0.7, 11.1],
  [56, 27, 16, 42, 5.2, 8.1],
  [82, 24, 10, -34, 2.0, 7.3],
  [4, 41, 22, 16, 4.7, 10.6],
  [24, 48, 15, -44, 1.8, 8.9],
  [47, 39, 12, 28, 4.5, 7.8],
  [73, 43, 30, -12, 0.9, 11.4],
  [91, 38, 14, 39, 3.7, 8.0],
  [15, 62, 27, -27, 5.4, 10.9],
  [38, 67, 10, 18, 1.5, 7.5],
  [61, 58, 18, -41, 3.9, 9.8],
  [83, 65, 24, 25, 0.4, 10.4],
  [9, 83, 13, -9, 2.9, 8.2],
  [29, 89, 20, 36, 4.8, 9.7],
  [52, 79, 14, -33, 2.1, 7.7],
  [76, 87, 26, 12, 5.9, 11.2],
  [94, 78, 11, -25, 1.0, 7.4],
] as const;

export function PixelBackground() {
  return (
    <div className="pixel-background" aria-hidden="true">
      {cubes.map(([left, top, size, rotation, delay, duration], index) => (
        <span
          key={`${left}-${top}-${index}`}
          className="pixel-background__dot"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            transform: `rotateX(58deg) rotateZ(${rotation}deg)`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
          }}
        />
      ))}
    </div>
  );
}
