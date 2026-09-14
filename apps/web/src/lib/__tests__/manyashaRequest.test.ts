// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { requestManyasha } from "../manyashaRequest";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("releases a stalled browser request with a retryable error", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })));
  const result = requestManyasha("/api/chat", [{ role: "user", content: "Вопрос" }]);
  const rejected = expect(result).rejects.toThrow("ваш вопрос сохранён");
  await vi.advanceTimersByTimeAsync(20000);
  await rejected;
});
it("does not render an HTTP failure as an assistant answer", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })));
  await expect(requestManyasha("/api/chat", [])).rejects.toThrow("Не удалось получить ответ");
});
