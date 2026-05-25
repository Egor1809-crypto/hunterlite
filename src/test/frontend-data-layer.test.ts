import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPost, ApiClientError } from "@/lib/api-client";
import { frontendApi } from "@/lib/frontend-api";

describe("frontend data layer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    await frontendApi.requestPasswordReset({ email: "manager@hunterlite.ru" });
    await frontendApi.completePasswordReset({ token: "reset-token", newPassword: "new-secret" });
    await frontendApi.session();
    await frontendApi.logout();
    await frontendApi.currentUser();
    await frontendApi.profile();
    await frontendApi.dashboard();
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
      "/api/auth/password-reset/request",
      "/api/auth/password-reset/complete",
      "/api/auth/session",
      "/api/auth/logout",
      "/api/users/me",
      "/api/users/profile",
      "/api/analytics/dashboard",
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
