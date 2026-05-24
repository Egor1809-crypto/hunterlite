import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setRole, type AppRole } from "@/lib/demo-auth-state";

const renderRoute = (path: string, role: AppRole) => {
  setRole(role);
  window.history.pushState({}, "", path);
  render(<App />);
};

afterEach(() => {
  cleanup();
});

describe("protected routes", () => {
  it("redirects employees away from manager pages", async () => {
    renderRoute("/manager", "employee");

    expect(await screen.findByText("Здравствуйте, Анна", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Обзор команды", { exact: false })).not.toBeInTheDocument();
  });

  it("redirects managers away from employee training pages", async () => {
    renderRoute("/modes", "manager");

    expect(await screen.findByText("Обзор команды", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Выберите режим", { exact: false })).not.toBeInTheDocument();
  });

  it("redirects admins away from employee training pages", async () => {
    renderRoute("/session/setup?mode=talk", "admin");

    expect(await screen.findByText("Состояние системы", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Настройка сессии", { exact: false })).not.toBeInTheDocument();
  });

  it("shows only the current role navigation group", async () => {
    renderRoute("/manager", "manager");

    expect((await screen.findAllByText("Руководитель")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Режимы")).not.toBeInTheDocument();
    expect(screen.queryByText("Система")).not.toBeInTheDocument();
    expect(screen.queryByText("Пользователи")).not.toBeInTheDocument();
  });
});
