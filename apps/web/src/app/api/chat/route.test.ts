// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("LLM_API_KEY", "test-only");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
const request = () => new NextRequest("http://localhost/api/chat", {
  method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "Подходит ли мне БФЛ?" }] }),
});
const answer = () => new Response(JSON.stringify({ choices: [{ message: { content: "Расскажите о долгах и доходе." } }] }));

it("returns an answer when the first provider request fails", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("timeout", { status: 524 })).mockResolvedValueOnce(answer());
  vi.stubGlobal("fetch", fetcher);
  const { POST } = await import("./route");
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect((await result.json()).reply).toContain("долгах");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("never sends internal reasoning to the user when the answer is empty", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "", reasoning_content: "PRIVATE_REASONING" } }] }))).mockResolvedValueOnce(answer()));
  const { POST } = await import("./route");
  const result = await POST(request());
  expect((await result.json()).reply).toBe("Расскажите о долгах и доходе.");
});

it("aborts a stalled provider and answers via the reserve model", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })).mockResolvedValueOnce(answer());
  vi.stubGlobal("fetch", fetcher);
  const { POST } = await import("./route");
  const pending = POST(request());
  await vi.advanceTimersByTimeAsync(8100);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect((await pending).status).toBe(200);
});
