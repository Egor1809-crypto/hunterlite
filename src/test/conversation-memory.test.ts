import { describe, expect, it } from "vitest";
import { buildConversationMemory } from "@/lib/conversation-memory";

describe("conversation memory", () => {
  it("keeps recent dialogue and extracts practical client facts", () => {
    const memory = buildConversationMemory([
      { from: "ai", text: "Здравствуйте, меня зовут Иван. У меня квартира и машина." },
      { from: "user", text: "Понял, давайте разберём имущество." },
      { from: "ai", text: "Боюсь, что заберут всё. Долг 900 000 руб." },
    ]);

    expect(memory.recentMessages).toHaveLength(3);
    expect(memory.summary).toContain("Клиент: Боюсь");
    expect(memory.facts).toEqual(
      expect.arrayContaining([
        expect.stringContaining("имя: Иван"),
        expect.stringContaining("имущество: квартира и машина"),
        expect.stringContaining("долг: 900 000 руб"),
        expect.stringContaining("опасение: Боюсь"),
      ]),
    );
  });
});
