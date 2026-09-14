import { describe, expect, it } from "vitest";
import { resultScoringState } from "./resultScoring";
describe("the displayed grade is the completed assessment", () => {
  it("does not expose provisional 40 while analysis is pending", () => {
    expect(resultScoringState(40.4, { _scoring_pending: true })).toBe("pending");
  });
  it("does not replace provider failure with zero or old points", () => {
    expect(resultScoringState(40, { _scoring_unavailable: true })).toBe("unavailable");
  });
  it("accepts a real zero and full scores without counting turns or requiring legacy judge", () => {
    for (const score of [0, 4, 100]) expect(resultScoringState(score, { _scoring_version: "conversation-quality-v1" })).toBe("ready");
  });
  it("keeps missing or malformed scores out of the report", () => {
    for (const score of [null, undefined, NaN, "40"]) expect(resultScoringState(score, {})).toBe("pending");
  });
});
