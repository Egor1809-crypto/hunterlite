import { describe, it, expect } from "vitest";
import { resolveTabParam, TAB_ALIASES } from "../dashboard-tabs";

describe("resolveTabParam", () => {
  it("returns null when there's no tab in the URL", () => {
    expect(resolveTabParam(null)).toBeNull();
    expect(resolveTabParam("")).toBeNull();
  });

  it("passes canonical tab ids through unchanged", () => {
    for (const id of ["overview", "team"]) {
      expect(resolveTabParam(id)).toBe(id);
    }
  });

  it("remaps legacy ids to canonical ids", () => {
    expect(resolveTabParam("analytics")).toBe("team");
  });

  it("falls back to overview for unknown ids", () => {
    expect(resolveTabParam("garbage")).toBe("overview");
    expect(resolveTabParam("methodology")).toBe("overview");
    expect(resolveTabParam("scoring")).toBe("overview");
    expect(resolveTabParam("../etc/passwd")).toBe("overview");
  });
});
