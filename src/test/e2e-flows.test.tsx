import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { defaultCallScripts } from "@/lib/default-training-content";
import { setRole, type AppRole } from "@/lib/demo-auth-state";

const apiOk = <TData,>(data: TData, status = 200) =>
  Promise.resolve(new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  }));

const installFetchMock = () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/auth/login")) {
      return apiOk({
        user: {
          id: "employee",
          name: "Анна Петрова",
          firstName: "Анна",
          role: "employee" as AppRole,
          roleLabel: "Юрист-консультант",
          email: "a.petrova@hunterlite.ru",
          status: "Допущен",
          avgScore: 82,
          examPassed: false,
          weeklyTrainings: 6,
        },
        homePath: "/dashboard",
      });
    }

    if (url.includes("/api/users/me")) {
      return apiOk({
        id: "employee",
        name: "Анна Петрова",
        firstName: "Анна",
        role: "employee" as AppRole,
        roleLabel: "Юрист-консультант",
        email: "a.petrova@hunterlite.ru",
        status: "Допущен",
        avgScore: 82,
        examPassed: false,
        weeklyTrainings: 6,
      });
    }

    if (url.endsWith("/api/trainings/call-scripts")) {
      return apiOk(defaultCallScripts);
    }

    if (url.endsWith("/api/ai/chat")) {
      return apiOk({
        reply: defaultCallScripts[0].nodes?.[1]?.clientReplica ?? "Продолжим разговор.",
        scoreDelta: 0,
        mistakes: [],
        recommendations: [],
        sessionEnded: false,
      });
    }

    if (url.endsWith("/api/ai/speech")) {
      return apiOk({ audioBase64: "", contentType: "audio/mpeg" });
    }

    if (url.endsWith("/api/notifications")) {
      return apiOk([
        {
          id: "e2e-notification",
          title: "Готов отчёт",
          body: "Недельный отчёт руководителя сформирован.",
          time: "сейчас",
          tone: "success",
          unread: true,
        },
      ]);
    }

    if (url.endsWith("/api/admin/call-scripts") && method === "GET") {
      return apiOk([]);
    }

    if (url.endsWith("/api/admin/call-scripts") && method === "POST") {
      return apiOk({
        id: "script-e2e",
        title: "E2E звонок",
        clientProfile: { name: "Евгений", debt: "900 000 руб" },
        nodes: [
          {
            id: "node-e2e",
            scriptId: "script-e2e",
            clientReplica: "Здравствуйте, хочу узнать про банкротство.",
            answerFormat: "text",
            isSuccessEnd: false,
            isFailEnd: false,
          },
        ],
      });
    }

    return apiOk(null);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.cookie = "hunterlite_csrf=; Max-Age=0; Path=/";
});

describe("e2e smoke flows", () => {
  it("logs in through backend credentials and opens employee consent", async () => {
    const fetchMock = installFetchMock();
    window.history.pushState({}, "", "/login");

    render(<App />);

    fireEvent.change(await screen.findByLabelText("Корпоративный email"), {
      target: { value: "a.petrova@hunterlite.ru" },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText(/Согласие на обработку данных/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("runs a talk training turn from client replica to employee answer", async () => {
    installFetchMock();
    setRole("employee");
    window.history.pushState({}, "", "/session/talk");

    render(<App />);

    expect(await screen.findByText(/что произойдет с моим имуществом/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ответьте клиенту/i);
    fireEvent.change(input, {
      target: { value: "Понимаю ваше беспокойство, давайте разберём имущество и исключения." },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText(/Понимаю ваше беспокойство/i)).toBeInTheDocument();
    expect(await screen.findByText(/если это моё единственное жильё/i)).toBeInTheDocument();
  });

  it("shows an exam pass result at the 88 point threshold", async () => {
    setRole("employee");
    window.history.pushState({}, "", "/session/result?score=88&mode=exam");

    render(<App />);

    expect(await screen.findByText("Экзамен сдан")).toBeInTheDocument();
    expect(screen.getByText(/Проходной порог · 88/i)).toBeInTheDocument();
  });

  it("renders live notifications from the backend feed", async () => {
    installFetchMock();
    setRole("employee");
    window.history.pushState({}, "", "/notifications");

    render(<App />);

    expect(await screen.findByText("Готов отчёт")).toBeInTheDocument();
    expect(screen.getByText("Недельный отчёт руководителя сформирован.")).toBeInTheDocument();
  });

  it("lets an admin create a call script", async () => {
    const fetchMock = installFetchMock();
    setRole("admin");
    document.cookie = "hunterlite_csrf=token-123; Path=/";
    window.history.pushState({}, "", "/admin/scripts");

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Создать скрипт/i }));
    fireEvent.change(screen.getByPlaceholderText(/Входящий звонок/i), {
      target: { value: "E2E звонок" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Алло, я по поводу банкротства/i), {
      target: { value: "Здравствуйте, хочу узнать про банкротство." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить скрипт" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/call-scripts",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
