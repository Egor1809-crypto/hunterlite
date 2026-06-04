/**
 * P1 de-gamification regression fence (frontend, customer decision #3 + #2).
 *
 * The full results page boots dynamic imports, framer-motion, charts and a
 * Zustand store — a real mount is slow and brittle (same rationale the
 * hangup-flow test documents). The contract we must fence here is a pure
 * source-surface fact: after P1 the results page must NOT render the
 * story-mode panel («История клиента / Звонок N из M / последствия»), the
 * CRM «ВЫПОЛНЕНИЕ ОБЕЩАНИЙ» promise panel, or any XP affordance.
 *
 * We assert against the page source. These tests fail on pre-P1 code, where
 * the page rendered `story.story_name`, the «Звонок N из M» copy, the
 * «ВЫПОЛНЕНИЕ ОБЕЩАНИЙ» heading and read `result.story_calls` /
 * `result.promise_fulfillment`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const rawSource = readFileSync(resolve(here, "../page.tsx"), "utf8");

// Strip comments before asserting: the P1 removals left explanatory
// comments that legitimately mention «story» / «XP» / «level_up» to document
// WHY the surface is gone. We fence the rendered/executed code, not prose.
const pageSource = rawSource
  // /* ... */ block comments (incl. JSX {/* ... */})
  .replace(/\/\*[\s\S]*?\*\//g, "")
  // // line comments
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("results page — story-mode cut (decision #3)", () => {
  it("does not render the story panel heading «История клиента»", () => {
    expect(pageSource).not.toContain("История клиента");
  });

  it("does not render the «Звонок N из M» story copy", () => {
    expect(pageSource).not.toMatch(/Звонок\s*\{.*из/);
  });

  it("does not read story / story_calls from the result", () => {
    expect(pageSource).not.toContain("result.story");
    expect(pageSource).not.toContain(".story_calls");
    expect(pageSource).not.toContain("call_number_in_story");
  });

  it("does not render the promise-fulfillment panel", () => {
    expect(pageSource).not.toContain("ВЫПОЛНЕНИЕ ОБЕЩАНИЙ");
    expect(pageSource).not.toContain("promise_fulfillment");
  });

  it("no longer imports the Handshake icon (was only used by the promise panel)", () => {
    expect(pageSource).not.toContain("Handshake");
  });
});

describe("results page — XP cut (decision #2)", () => {
  it("does not render an XP gain badge («+N XP»)", () => {
    expect(pageSource).not.toMatch(/\+\s*\{[^}]*\}\s*XP/);
    expect(pageSource).not.toMatch(/grand_total[^]*XP/);
  });

  it("does not render a level-up affordance", () => {
    expect(pageSource).not.toContain("level_up");
    expect(pageSource).not.toContain("levelUp");
  });
});
