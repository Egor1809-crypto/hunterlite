import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPost, ApiClientError } from "@/lib/api-client";
import { frontendApi, withDemoFallback } from "@/lib/frontend-api";
import {
  getCurrentUser,
  getDashboardSummary,
  getEmployeeProfile,
  getEmployees,
  getManagerSummary,
  getManagerReports,
  getNotifications,
  getProfileSummary,
  getSessionOptions,
  getTrainingHistory,
  getWeakTopics,
} from "@/lib/demo-api";

describe("frontend data layer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps demo auth roles to API-shaped current users", () => {
    expect(getCurrentUser("employee")).toMatchObject({
      id: "employee",
      name: "Анна Петрова",
      role: "employee",
      roleLabel: "Юрист-консультант",
      avgScore: 82,
    });

    expect(getCurrentUser("manager")).toMatchObject({
      id: "manager",
      name: "Ольга Литвинова",
      role: "manager",
      roleLabel: "Руководитель",
    });
  });

  it("returns profile data in one API-shaped payload", () => {
    const profile = getProfileSummary("employee");

    expect(profile.user.email).toBe("a.petrova@hunterlite.ru");
    expect(profile.weakTopics.length).toBeGreaterThan(0);
    expect(profile.weakTopics[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        topic: expect.any(String),
        errors: expect.any(Number),
        recommendation: expect.any(String),
      }),
    );
  });

  it("returns notification DTOs with future action URLs", () => {
    const notifications = getNotifications();

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0]).toEqual(
      expect.objectContaining({
        id: "daily-training",
        title: "Ежедневная тренировка",
        body: expect.any(String),
        tone: "info",
        unread: true,
        actionUrl: "/session/setup?mode=talk",
      }),
    );
  });

  it("keeps weak topics API-shaped and stable", () => {
    expect(getWeakTopics()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          topic: "Имущество должника",
          errors: 38,
        }),
      ]),
    );
  });

  it("returns training history as typed DTOs", () => {
    expect(getTrainingHistory()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          date: "28.04.2026",
          mode: "Экзамен",
          score: 76,
          status: "Сдан",
        }),
      ]),
    );
  });

  it("returns dashboard data in one API-shaped payload", () => {
    const dashboard = getDashboardSummary("employee");

    expect(dashboard.user.firstName).toBe("Анна");
    expect(dashboard.lastSession).toEqual(
      expect.objectContaining({
        mode: "Тренировка",
        topic: "Возражения клиента",
      }),
    );
    expect(dashboard.nextTask).toEqual({
      title: "Аттестация: Имущество должника",
      dueDate: "до 5 мая 2026",
      readiness: 74,
    });
    expect(dashboard.notifications.length).toBeLessThanOrEqual(3);
  });

  it("returns manager team data without exposing raw mocks to pages", () => {
    const manager = getManagerSummary();
    const reports = getManagerReports();

    expect(manager.kpi.totalEmployees).toBe(getEmployees().length);
    expect(manager.kpi.avgScore).toBeGreaterThan(0);
    expect(manager.scoreTrend[0]).toEqual(expect.objectContaining({ week: "Н1", score: expect.any(Number) }));
    expect(manager.topWeakTopics[0]).toEqual(
      expect.objectContaining({
        topic: "Имущество должника",
        errors: 38,
      }),
    );
    expect(reports.summary.avgScore).toBe(manager.kpi.avgScore);
    expect(reports.scoreDistribution).toEqual(
      expect.arrayContaining([expect.objectContaining({ range: "70-85", percent: expect.any(Number) })]),
    );
    expect(reports.attention[0]).toEqual(
      expect.objectContaining({
        employeeId: expect.any(String),
        action: expect.stringContaining("Назначить курс"),
      }),
    );
  });

  it("returns employee profile data by id with fallback", () => {
    expect(getEmployeeProfile("2").employee).toEqual(
      expect.objectContaining({
        id: "2",
        name: "Иван Смирнов",
        status: "Не допущен",
      }),
    );
    expect(getEmployeeProfile("missing").employee.id).toBe("1");
  });

  it("returns session setup options", () => {
    const options = getSessionOptions();

    expect(options.topics).toContain("Имущество должника");
    expect(options.difficulties).toContain("Средний");
  });

  it("reads successful API responses through apiGet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, data: { service: "hunterlite-api" } }),
      })),
    );

    await expect(apiGet<{ service: string }>("/health")).resolves.toEqual({
      service: "hunterlite-api",
    });
    expect(fetch).toHaveBeenCalledWith("/api/health", expect.objectContaining({ credentials: "include" }));
  });

  it("sends CSRF tokens with mutating API requests after login", async () => {
    document.cookie = "hunterlite_csrf=token-123; Path=/";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, data: { loggedOut: true } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/auth/logout");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-CSRF-Token": "token-123",
        }),
      }),
    );
  });

  it("maps frontend API helpers to backend route paths", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, data: {} }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await frontendApi.login({ email: "manager@hunterlite.ru", password: "secret" });
    await frontendApi.requestTelegramCode({ phone: "+79000000000" });
    await frontendApi.loginWithTelegramCode({ phone: "+79000000000", code: "1809" });
    await frontendApi.requestPasswordReset({ email: "manager@hunterlite.ru" });
    await frontendApi.completePasswordReset({ token: "reset-token", newPassword: "new-secret" });
    await frontendApi.session();
    await frontendApi.logout();
    await frontendApi.currentUser("manager");
    await frontendApi.profile("employee");
    await frontendApi.dashboard("employee");
    await frontendApi.notifications();
    await frontendApi.weakTopics();
    await frontendApi.trainingHistory();
    await frontendApi.generateTrainingReply({
      topic: "Имущество должника",
      mode: "talk",
      step: 0,
      totalSteps: 3,
      userMessage: "Здравствуйте",
      messages: [{ from: "user", text: "Здравствуйте" }],
    });
    await frontendApi.synthesizeSpeech({ text: "Здравствуйте" });
    await frontendApi.transcribeSpeech({ audioBase64: "YXVkaW8=", mimeType: "audio/webm" });
    await frontendApi.managerSummary();
    await frontendApi.managerReports();
    await frontendApi.employeeProfile("2");
    await frontendApi.assignEmployeeCourse("2", { topic: "Имущество должника" });
    await frontendApi.sessionOptions();
    await frontendApi.createTrainingSession({
      topic: "Имущество должника",
      mode: "talk",
      difficulty: "medium",
      format: "text",
      character: "anxious",
    });
    await frontendApi.trainingSessionDetail("session-1");
    await frontendApi.addTrainingMessage("session-1", { from: "user", text: "Добрый день." });
    await frontendApi.completeTrainingSession("session-1", {
      score: 82,
      criteria: [],
      mistakes: [],
      recommendations: [],
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/login",
      "/api/auth/telegram/request-code",
      "/api/auth/telegram/login",
      "/api/auth/password-reset/request",
      "/api/auth/password-reset/complete",
      "/api/auth/session",
      "/api/auth/logout",
      "/api/users/me?role=manager",
      "/api/users/profile?role=employee",
      "/api/analytics/dashboard?role=employee",
      "/api/notifications",
      "/api/trainings/weak-topics",
      "/api/trainings/history",
      "/api/ai/chat",
      "/api/ai/speech",
      "/api/ai/transcriptions",
      "/api/analytics/manager",
      "/api/analytics/manager/reports",
      "/api/analytics/manager/employees/2",
      "/api/analytics/manager/employees/2/course",
      "/api/trainings/session-options",
      "/api/trainings/sessions",
      "/api/trainings/sessions/session-1",
      "/api/trainings/sessions/session-1/messages",
      "/api/trainings/sessions/session-1/complete",
    ]);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "manager@hunterlite.ru", password: "secret" }),
      }),
    );
  });

  it("falls back to demo data when API requests are unavailable", async () => {
    await expect(
      withDemoFallback(
        async () => {
          throw new TypeError("Network error");
        },
        () => ({ source: "demo" }),
      ),
    ).resolves.toEqual({ source: "demo" });
  });

  it("throws typed client errors for failed API responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        }),
      })),
    );

    await expect(apiGet("/me")).rejects.toBeInstanceOf(ApiClientError);
  });
});
