import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChampionshipPage from "./ChampionshipPage";
import { championshipApi } from "@/lib/championship";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/championship", () => ({
  championshipApi: { current: vi.fn(), me: vi.fn(), winners: vi.fn(), leaderboard: vi.fn(), enroll: vi.fn() },
  seasonLabel: () => "Лето–Осень",
}));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    useReducedMotion: () => true,
    useScroll: () => ({ scrollYProgress: 0 }),
    useTransform: () => 1,
    motion: Object.fromEntries(["div", "section", "h1", "img"].map(tag => [tag, React.forwardRef(function Motion(props: any, ref: any) {
      const { initial, animate, transition, whileInView, viewport, ...rest } = props;
      return React.createElement(tag, { ...rest, ref });
    })])),
  };
});
const season = {
  id: "season", number: 1, season_type: "summer_autumn" as const,
  title: "Чемпионат сезона · Лето–Осень 2026", status: "active" as const,
  starts_at: "2026-06-01", ends_at: "2026-12-01", tally_starts_at: "2026-11-30", winner_mode: "draw" as const,
  prize_fund: [{ rank: 1, name: "MacBook Air", image: "/macbook.png" }],
};
const entry = { enrolled: false, status: null, score: 0, criteria: { exam_passed: true, subscribed: true, courses_done: false, review_left: false } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(championshipApi.current).mockResolvedValue({ championship: season, qualified_count: 1 });
  vi.mocked(championshipApi.me).mockResolvedValue(entry);
  vi.mocked(championshipApi.leaderboard).mockResolvedValue([]);
  vi.mocked(championshipApi.winners).mockResolvedValue([]);
});
afterEach(cleanup);

describe("championship shared presentation", () => {
  it("shows prize imagery and personal requirements inside the platform, then confirms enrollment", async () => {
    vi.mocked(championshipApi.enroll).mockResolvedValue({ ...entry, enrolled: true });
    render(<ChampionshipPage surface="app" />);
    expect(await screen.findByRole("img", { name: "MacBook Air" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Пять шагов до розыгрыша." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Проверьте подписку/ })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: /Сдайте аттестацию/ })).toHaveTextContent("Выполнено");
    const button = screen.getByRole("button", { name: /Участвовать в розыгрыше/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText("Вы участвуете в розыгрыше")).toBeInTheDocument();
    expect(championshipApi.enroll).toHaveBeenCalledOnce();
  });
  it("keeps an enrollment failure visible", async () => {
    vi.mocked(championshipApi.enroll).mockRejectedValue(new Error("offline"));
    render(<ChampionshipPage surface="app" />);
    const button = screen.getByRole("button", { name: /Участвовать в розыгрыше/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отправить заявку");
  });
  it("does not accept applications when no season is open", async () => {
    vi.mocked(championshipApi.current).mockResolvedValue({ championship: null, qualified_count: 0 });
    render(<ChampionshipPage surface="app" />);
    expect(await screen.findByText(/Сейчас нет открытого сезона/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Участвовать в розыгрыше/ })).toBeDisabled();
  });
  it("shows the same prize presentation to guests without requesting personal data", async () => {
    render(<ChampionshipPage surface="landing" />);
    expect(await screen.findByRole("img", { name: "MacBook Air" })).toBeInTheDocument();
    expect(championshipApi.me).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Начать участвовать/ })).toBeInTheDocument();
  });
});
