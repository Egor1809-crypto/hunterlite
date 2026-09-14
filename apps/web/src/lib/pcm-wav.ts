/** A complete WAV file on every snapshot, including during Safari recording. */
export function pcmWav(chunks: Float32Array[]): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const label = (at: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  label(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  label(8, "WAVE");
  label(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const sample of chunk) {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
      offset += 2;
    }
  return new Blob([buffer], { type: "audio/wav" });
}
