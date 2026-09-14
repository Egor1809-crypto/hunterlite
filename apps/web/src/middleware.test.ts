// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("landing after clearing site data", () => {
  it.each(["legalhunter.pro", "www.legalhunter.pro"])("keeps the public host %s behind nginx", (host) => {
    const response = middleware(new NextRequest("http://localhost:3000/cases", {headers:{host, "x-forwarded-proto":"https", "x-forwarded-host":"untrusted.example"}}));
    expect(response.headers.get("location")).toBe(`https://${host}/`);
  });
  it.each(["/home", "/cases", "/training/session/call", "/home?redirect=/login"])("returns %s to the landing without opening auth", (path) => {
    const response = middleware(new NextRequest(`https://legalhunter.pro${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://legalhunter.pro/");
  });
  it.each(["/", "/login", "/register", "/auth/callback?code=example", "/reset-password?token=example", "/legal/privacy", "/legal/cookies", "/exam/certificate/verify/example"])("keeps the explicit public route %s accessible", (path) => {
    const response = middleware(new NextRequest(`https://legalhunter.pro${path}`));
    expect(response.headers.get("location")).toBeNull();
  });
  it.each(["admin", "rop", "manager"])("preserves dashboard access rules for %s", (role) => {
    const token = `header.${Buffer.from(JSON.stringify({role})).toString("base64url")}.signature`;
    const response = middleware(new NextRequest("https://legalhunter.pro/dashboard", {headers:{cookie:`access_token=${token}`}}));
    expect(response.headers.get("location")).toBe(role === "manager" ? "https://legalhunter.pro/home" : null);
  });
  it("lets an existing session restore its private page", () => {
    const response = middleware(new NextRequest("https://legalhunter.pro/cases", {headers:{cookie:"vh_authenticated=1"}}));
    expect(response.headers.get("location")).toBeNull();
  });
});
