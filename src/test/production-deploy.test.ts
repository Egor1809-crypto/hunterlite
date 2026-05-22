import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("production deploy assets", () => {
  it("defines production compose services with restart policies and health checks", () => {
    const compose = read("deployment/docker-compose.prod.yml");

    expect(compose).toContain("postgres:");
    expect(compose).toContain("api:");
    expect(compose).toContain("web:");
    expect(compose).toContain("restart: unless-stopped");
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain("AUTH_DEMO_FALLBACK: \"false\"");
    expect(compose).toContain("/api/health");
  });

  it("serves the SPA through nginx and proxies API/SSE traffic", () => {
    const nginx = read("deployment/nginx.app.conf");

    expect(nginx).toContain("try_files $uri $uri/ /index.html");
    expect(nginx).toContain("location /api/");
    expect(nginx).toContain("location /api/notifications/stream");
    expect(nginx).toContain("proxy_buffering off");
    expect(nginx).toContain("X-Content-Type-Options");
  });

  it("keeps a production env template and database backup script", () => {
    const env = read("deployment/.env.production.example");
    const backup = read("deployment/backup-db.sh");

    expect(env).toContain("AUTH_DEMO_FALLBACK=false");
    expect(env).toContain("NAVI_CHAT_MODEL=gemini-3.5-flash");
    expect(backup).toContain("pg_dump");
    expect(backup).toContain("gzip");
  });
});
