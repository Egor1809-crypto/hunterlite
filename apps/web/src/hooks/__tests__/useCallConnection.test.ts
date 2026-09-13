import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { useCallConnection } from "../useCallConnection";
const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/ws", () => ({ createWebSocket: mocks.create }));
vi.mock("@/lib/api", () => ({ tryRefreshToken: mocks.refresh }));
let sockets: FakeSocket[] = [];
class FakeSocket {
  readyState = 1;
  sent: unknown[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  message(type: string) {
    this.onmessage?.({ data: JSON.stringify({ type, data: {} }) });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  mocks.create.mockImplementation(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("starts only after authentication and never replays audio after disconnect", async () => {
  const callback = vi.fn();
  const { result, unmount } = renderHook(() =>
    useCallConnection("session", callback),
  );
  expect(
    result.current.sendMessage({ type: "audio", data: { audio_b64: "old" } }),
  ).toBe(false);
  expect(sockets[0].sent).toEqual([]);
  act(() => sockets[0].message("auth.success"));
  expect(sockets[0].sent).toEqual([
    { type: "start", data: { session_id: "session" } },
  ]);
  act(() => sockets[0].message("ready"));
  expect(result.current.connected).toBe(true);
  act(() => sockets[0].close());
  expect(
    result.current.sendMessage({
      type: "audio",
      data: { audio_b64: "queued" },
    }),
  ).toBe(false);
  await act(async () => vi.advanceTimersByTime(1000));
  act(() => sockets[1].message("auth.success"));
  expect(sockets[1].sent).toEqual([
    { type: "start", data: { session_id: "session" } },
  ]);
  unmount();
  await act(async () => vi.advanceTimersByTime(60000));
  expect(sockets).toHaveLength(2);
});
