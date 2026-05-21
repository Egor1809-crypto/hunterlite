import { describe, expect, it } from "vitest";
import {
  aiClientCharacters,
  bankruptcyTopics,
  getMaxQuestionCount,
  isCorrectProcedureSequence,
  isPassingScore,
  passingScore,
  trainingEvaluationCriteria,
  trainingModes,
  validateScore,
  type SequenceTask,
} from "@/lib/training-logic";

describe("block 7 training logic", () => {
  it("keeps all three MVP training modes", () => {
    expect(trainingModes).toEqual(["talk", "exam", "chat_test"]);
  });

  it("uses the agreed 0-100 score range and 88 passing score", () => {
    expect(passingScore).toBe(88);
    expect(validateScore(0)).toBe(true);
    expect(validateScore(100)).toBe(true);
    expect(validateScore(-1)).toBe(false);
    expect(validateScore(101)).toBe(false);
    expect(validateScore(70.5)).toBe(false);
    expect(isPassingScore(87)).toBe(false);
    expect(isPassingScore(88)).toBe(true);
  });

  it("describes the agreed evaluation criteria", () => {
    expect(trainingEvaluationCriteria).toEqual([
      "legal_accuracy",
      "answer_structure",
      "safe_wording",
      "empathy",
      "objection_handling",
    ]);
  });

  it("supports different NAVI client personalities", () => {
    expect(aiClientCharacters).toEqual([
      "anxious",
      "aggressive",
      "skeptical",
      "distrustful",
      "rushed",
    ]);
  });

  it("limits question count by difficulty up to 100 questions", () => {
    expect(getMaxQuestionCount("basic")).toBe(20);
    expect(getMaxQuestionCount("medium")).toBe(50);
    expect(getMaxQuestionCount("hard")).toBe(100);
  });

  it("keeps bankruptcy topics as the MVP subject area", () => {
    expect(bankruptcyTopics).toContain("Имущество должника");
    expect(bankruptcyTopics).toContain("Процедура и сроки");
  });

  it("checks sequence tasks by the correct bankruptcy procedure order", () => {
    const task: SequenceTask = {
      id: "procedure-1",
      topic: "Процедура банкротства физического лица",
      prompt: "Расставьте этапы процедуры банкротства в правильном порядке.",
      steps: [
        { id: "court", title: "Подача заявления в арбитражный суд", order: 2 },
        { id: "prepare", title: "Сбор документов и подготовка заявления", order: 1 },
        { id: "decision", title: "Решение суда и завершение процедуры", order: 4 },
        { id: "procedure", title: "Введение процедуры реализации имущества", order: 3 },
      ],
    };

    expect(isCorrectProcedureSequence(task, ["prepare", "court", "procedure", "decision"])).toBe(true);
    expect(isCorrectProcedureSequence(task, ["court", "prepare", "procedure", "decision"])).toBe(false);
    expect(isCorrectProcedureSequence(task, ["prepare", "court"])).toBe(false);
  });
});
