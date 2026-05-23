import { describe, expect, it } from "vitest";
import { arenaQuestions } from "@/lib/arena-questions";

describe("arena questions", () => {
  it("uses only verified questions matched with Hunter888 wrong answers", () => {
    expect(arenaQuestions).toHaveLength(5);

    for (const question of arenaQuestions) {
      expect(question.source).toContain("Hunter888:");
      expect(question.sourceQuestionNumber).toBeGreaterThan(0);
      expect(question.options).toHaveLength(4);
      expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
      expect(question.options.filter((option) => !option.isCorrect)).toHaveLength(3);
    }
  });
});
