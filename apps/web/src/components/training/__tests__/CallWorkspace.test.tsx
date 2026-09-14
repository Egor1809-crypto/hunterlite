import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CallWorkspace, type CallLine } from "../CallWorkspace";
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
afterEach(cleanup);
const initial: CallLine[] = [{ role: "user", content: "Здравствуйте" }];
const props = {
  name: "Олег Соколов",
  age: 47,
  lines: initial,
  draft: "",
  previewUnavailable: false,
  recording: false,
  processing: false,
  status: "Можно говорить",
  stage: 1,
  onStage: vi.fn(),
  onSpeak: vi.fn(),
  onEnd: vi.fn(),
  disabled: false,
  ending: false,
  micBusy: false,
  audioLevel: 0,
};
it("keeps provisional dictation outside the scrolling transcript", () => {
  const { rerender } = render(<CallWorkspace {...props} />);
  const transcript = screen.getByRole("region", { name: "Текст разговора" });
  rerender(<CallWorkspace {...props} recording draft="Какая сумма долгов?" />);
  expect(screen.getByText("Какая сумма долгов?")).toBeVisible();
  expect(transcript).not.toContainElement(
    screen.getByText("Какая сумма долгов?"),
  );
  expect(
    screen.getByRole("button", { name: "Стоп и отправить" }),
  ).toBeEnabled();
});
it("follows new messages while preserving deliberate history reading", () => {
  const { rerender } = render(<CallWorkspace {...props} />);
  const transcript = screen.getByRole("region", { name: "Текст разговора" });
  Object.defineProperties(transcript, {
    scrollHeight: { value: 1500, configurable: true },
    clientHeight: { value: 500 },
  });
  rerender(
    <CallWorkspace
      {...props}
      lines={[...initial, { role: "assistant", content: "Слушаю вас" }]}
    />,
  );
  expect(transcript.scrollTop).toBe(1500);
  transcript.scrollTop = 100;
  fireEvent.scroll(transcript);
  rerender(
    <CallWorkspace
      {...props}
      lines={[
        ...initial,
        { role: "assistant", content: "Слушаю вас. Продолжайте." },
      ]}
    />,
  );
  expect(transcript.scrollTop).toBe(100);
  fireEvent.click(screen.getByRole("button", { name: "К последней реплике" }));
  expect(transcript.scrollTop).toBe(1500);
});
it("shows all seven selectable stages and preserves speak and end controls", () => {
  render(<CallWorkspace {...props} />);
  const buttons = screen.getAllByRole("button", { name: /^[1-7] / });
  expect(buttons).toHaveLength(7);
  fireEvent.click(buttons[6]);
  expect(props.onStage).toHaveBeenCalledWith(7);
  fireEvent.click(
    screen.getByRole("button", { name: "Говорить" }),
  );
  expect(props.onSpeak).toHaveBeenCalledOnce();
});
