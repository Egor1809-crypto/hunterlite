import { expect, it } from "vitest";
import { pcmWav } from "../pcm-wav";
function bytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}
it("builds a complete mono 16 kHz WAV with all cumulative samples", async () => {
  const blob = pcmWav([
    Float32Array.from([0, 1]),
    Float32Array.from([-1, 0.5]),
  ]);
  const buffer = await bytes(blob),
    view = new DataView(buffer);
  expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe("RIFF");
  expect(new TextDecoder().decode(buffer.slice(8, 12))).toBe("WAVE");
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(40, true)).toBe(8);
  expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
    0, 32767, -32768, 16383,
  ]);
});
