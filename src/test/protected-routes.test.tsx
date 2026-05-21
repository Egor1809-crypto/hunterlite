import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setDemoRole, type AppRole } from "@/lib/demo-auth-state";

const renderRoute = (path: string, role: AppRole) => {
  setDemoRole(role);
  window.history.pushState({}, "", path);
  render(<App />);
};

afterEach(() => {
  cleanup();
});

describe("protected routes", () => {
  it("redirects employees away from manager pages", () => {
    renderRoute("/manager", "employee");

    expect(screen.getByText("Здравствуйте, Анна", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Обзор команды", { exact: false })).not.toBeInTheDocument();
  });

  it("redirects managers away from employee training pages", () => {
    renderRoute("/modes", "manager");

    expect(screen.getByText("Обзор команды", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Выберите режим", { exact: false })).not.toBeInTheDocument();
  });

  it("redirects admins away from employee training pages", () => {
    renderRoute("/session/setup?mode=talk", "admin");

    expect(screen.getByText("Состояние системы", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Настройка сессии", { exact: false })).not.toBeInTheDocument();
  });

  it("shows only the current role navigation group", () => {
    renderRoute("/manager", "manager");

    expect(screen.getAllByText("Руководитель").length).toBeGreaterThan(0);
    expect(screen.queryByText("Режимы")).not.toBeInTheDocument();
    expect(screen.queryByText("Система")).not.toBeInTheDocument();
    expect(screen.queryByText("Пользователи")).not.toBeInTheDocument();
  });
});
