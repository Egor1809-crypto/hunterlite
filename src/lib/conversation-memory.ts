import type { DialogMessageDto } from "@/lib/api-contracts";

export type ConversationMemory = {
  recentMessages: DialogMessageDto[];
  summary: string;
  facts: string[];
};

const maxRecentMessages = 16;
const maxFactLength = 120;

const factPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "имя", pattern: /(?:^|[\s,.;:!?])(?:меня зовут|я)\s+([А-ЯЁA-Z][а-яёa-z-]{2,})(?=$|[\s,.;:!?])/u },
  { label: "долг", pattern: /(?:^|[\s,.;:!?])(\d[\d\s.,]*(?:тыс|млн|миллион|миллиона|миллионов|руб|₽)[^.!?\n]*)/iu },
  { label: "имущество", pattern: /(?:^|[\s,.;:!?])((?:квартира|дом|машина|автомобиль|ипотека|земля|гараж)[^.!?\n]*)/iu },
  { label: "доход", pattern: /(?:^|[\s,.;:!?])((?:зарплата|пенсия|доход|пособие|алименты)[^.!?\n]*)/iu },
  { label: "опасение", pattern: /(?:^|[\s,.;:!?])((?:боюсь|переживаю|страшно|сомневаюсь|не уверен)[^.!?\n]*)/iu },
];

const normalizeText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const addFact = (facts: string[], fact: string) => {
  const normalized = normalizeText(fact).slice(0, maxFactLength);

  if (normalized && !facts.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
    facts.push(normalized);
  }
};

export const buildConversationMemory = (messages: DialogMessageDto[]): ConversationMemory => {
  const normalizedMessages = messages
    .filter((message) => message.text.trim())
    .map((message) => ({ from: message.from, text: normalizeText(message.text) }));
  const facts: string[] = [];

  normalizedMessages.forEach((message) => {
    factPatterns.forEach(({ label, pattern }) => {
      const match = message.text.match(pattern);
      const value = match?.[1]?.trim();

      if (value) addFact(facts, `${label}: ${value}`);
    });
  });

  const recentMessages = normalizedMessages.slice(-maxRecentMessages);
  const summary = recentMessages
    .slice(-8)
    .map((message) => `${message.from === "user" ? "Сотрудник" : "Клиент"}: ${message.text}`)
    .join("\n");

  return {
    recentMessages,
    summary,
    facts: facts.slice(-8),
  };
};
