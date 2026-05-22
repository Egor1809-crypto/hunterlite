import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setDemoRole, type AppRole } from "@/lib/demo-auth-state";

const routes = [
  { path: "/login", text: "Вход в кабинет" },
  { path: "/consent", text: "Согласие на обработку данных" },
  { path: "/dashboard", text: "Здравствуйте, Анна", role: "employee" },
  { path: "/modes", text: "Выберите режим", role: "employee" },
  { path: "/session/setup?mode=talk", text: "Настройка сессии", role: "employee" },
  { path: "/session/talk", text: "Тренировка", role: "employee" },
  { path: "/session/exam", text: "Экзамен", role: "employee" },
  { path: "/session/chat-test", text: "Чат-тест", role: "employee" },
  { path: "/session/cases", text: "Кейсы по банкротству", role: "employee" },
  { path: "/session/answer-review", text: "Разбор ответа", role: "employee" },
  { path: "/session/result", text: "Сессия завершена", role: "employee" },
  { path: "/remedial-course", text: "Назначен курс подготовки", role: "employee" },
  { path: "/history", text: "История тренировок", role: "employee" },
  { path: "/weak-topics", text: "Слабые темы", role: "employee" },
  { path: "/notifications", text: "Уведомления", role: "employee" },
  { path: "/bfl-book", text: "Книга БФЛ", role: "employee" },
  { path: "/profile", text: "Профиль пользователя", role: "employee" },
  { path: "/manager", text: "Обзор команды", role: "manager" },
  { path: "/manager/employee/1", text: "Анна Петрова", role: "manager" },
  { path: "/manager/reports", text: "Отчёты", role: "manager" },
  { path: "/admin", text: "Состояние системы", role: "admin" },
  { path: "/admin/users", text: "Пользователи", role: "admin" },
  { path: "/admin/settings", text: "Настройки", role: "admin" },
  { path: "/admin/methodology", text: "Книга БФЛ и учебные материалы", role: "admin" },
  { path: "/client", text: "Задайте вопрос по банкротству физических лиц" },
  { path: "/client/lead", text: "Заявка на консультацию" },
];

afterEach(() => {
  cleanup();
});

describe("application routes", () => {
  it.each(routes)("renders $path", ({ path, text, role }) => {
    setDemoRole((role || "employee") as AppRole);
    window.history.pushState({}, "", path);
    render(<App />);

    expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
  });
});
