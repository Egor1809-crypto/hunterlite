/* Same microphone stream as MediaRecorder; no second device permission.
   Mono 16 kHz PCM snapshots for live captions. No audio is played back. */
class CallPreviewProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.sum = 0;
    this.count = 0;
    this.phase = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.sum += sample;
      this.count++;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.samples.push(this.sum / this.count);
        this.phase -= sampleRate;
        this.sum = 0;
        this.count = 0;
      }
      if (this.samples.length >= 24000) {
        const pcm = Float32Array.from(this.samples);
        this.port.postMessage(pcm, [pcm.buffer]);
        this.samples = [];
      }
    }
    return true;
  }
}
registerProcessor('call-preview', CallPreviewProcessor);
