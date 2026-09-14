import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ManyashaChat from "../ManyashaChat";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("clears typing after failure and retries the same question without duplicating it", async () => {
  Element.prototype.scrollIntoView = vi.fn();
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
    ok: true, json: async () => ({ reply: "Расскажите о вашей ситуации." }),
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ManyashaChat config={{ apiEndpoint: "/api/chat", hidePaths: [] }} autoOpen forceShow />);
  const input = screen.getByPlaceholderText("Напишите сообщение...");
  fireEvent.change(input, { target: { value: "Подходит ли мне БФЛ?" } });
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось получить ответ");
  expect(input).toBeEnabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Повторить вопрос" }));
  expect(await screen.findByText("Расскажите о вашей ситуации.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  const sent = JSON.parse(fetcher.mock.calls[1][1].body).messages;
  expect(sent).toEqual([{ role: "user", content: "Подходит ли мне БФЛ?" }]);
});
