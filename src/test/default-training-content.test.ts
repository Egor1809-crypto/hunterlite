import { describe, expect, it } from "vitest";
import { createLocalTrainingReply, defaultCallScripts } from "@/lib/default-training-content";

describe("default training content", () => {
  it("provides a callable bankruptcy script when admin scripts are empty", () => {
    expect(defaultCallScripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "default-debtor-property",
          title: "Симуляция звонка",
          nodes: expect.arrayContaining([
            expect.objectContaining({
              clientReplica: expect.stringContaining("квартира и машина"),
              answerFormat: "voice",
            }),
          ]),
        }),
      ]),
    );
  });

  it("creates a local next client reply when AI chat is unavailable", () => {
    const reply = createLocalTrainingReply({
      topic: "Имущество должника",
      mode: "talk",
      step: 0,
      totalSteps: 5,
      userMessage: "Понимаю, давайте разберём квартиру и машину отдельно.",
      messages: [{ from: "user", text: "Понимаю, давайте разберём квартиру и машину отдельно." }],
      scriptContext: {
        nextClientReplica: "А квартиру точно не заберут?",
      },
    });

    expect(reply).toEqual(
      expect.objectContaining({
        reply: "А квартиру точно не заберут?",
        sessionEnded: false,
      }),
    );
  });

  it("penalizes risky guarantees in local mode", () => {
    const reply = createLocalTrainingReply({
      topic: "Имущество должника",
      mode: "talk",
      step: 4,
      totalSteps: 5,
      userMessage: "Гарантирую, что ничего не заберут.",
      messages: [{ from: "user", text: "Гарантирую, что ничего не заберут." }],
      scriptContext: {},
    });

    expect(reply.scoreDelta).toBeGreaterThan(0);
    expect(reply.mistakes).toEqual(expect.arrayContaining([expect.stringContaining("рискованное обещание")]));
    expect(reply.sessionEnded).toBe(true);
  });
});
