import { act, renderHook } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { useTTS } from "../useTTS";
vi.mock("@/hooks/useSound", () => ({
  getEffectiveVolume: () => 1,
  subscribeVolume: () => () => {},
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("ignores an autoplay rejection from an interrupted audio reply", async () => {
  let rejectPlay: (reason: unknown) => void = () => {};
  class AudioMock {
    volume = 1;
    currentTime = 0;
    onended = null;
    onerror = null;
    onloadeddata = null;
    pause() {}
    addEventListener() {}
    play() {
      return new Promise<void>((_, reject) => {
        rejectPlay = reject;
      });
    }
  }
  vi.stubGlobal("Audio", AudioMock);
  vi.stubGlobal("speechSynthesis", {
    cancel: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  const { result, unmount } = renderHook(() => useTTS());
  act(() =>
    result.current.queueAudioChunk({
      audio: "YXVkaW8=",
      index: 0,
      isLast: false,
    }),
  );
  act(() => result.current.stop());
  await act(async () =>
    rejectPlay(new DOMException("blocked", "NotAllowedError")),
  );
  expect(result.current.needsAudioUnlock).toBe(false);
  expect(result.current.speaking).toBe(false);
  unmount();
});
