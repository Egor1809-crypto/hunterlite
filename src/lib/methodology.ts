export type MethodologyChapterStatus = "База" | "Важно" | "Риск" | "Практика";

export type MethodologyChapter = {
  id: string;
  title: string;
  status: MethodologyChapterStatus;
  owner: string;
  updatedAt: string;
  trainingLinks: string[];
  items: string[];
};

export const bflMethodologyChapters: MethodologyChapter[] = [
  {
    id: "grounds",
    title: "Основания для банкротства",
    status: "База",
    owner: "Методолог",
    updatedAt: "22.05.2026",
    trainingLinks: ["Экзамен", "Чат-тест"],
    items: ["Признаки неплатежеспособности", "Сумма и структура долга", "Когда процедура не подходит"],
  },
  {
    id: "property",
    title: "Имущество должника",
    status: "Важно",
    owner: "Юрист-эксперт",
    updatedAt: "22.05.2026",
    trainingLinks: ["Голосовая тренировка", "Кейсы"],
    items: ["Единственное жильё", "Ипотека и залог", "Автомобиль, счета и сделки"],
  },
  {
    id: "non-dischargeable-debts",
    title: "Долги, которые не списываются",
    status: "Риск",
    owner: "Контроль качества",
    updatedAt: "21.05.2026",
    trainingLinks: ["Кейсы", "Возражения"],
    items: ["Алименты", "Вред жизни и здоровью", "Субсидиарная ответственность"],
  },
  {
    id: "consequences",
    title: "Последствия процедуры",
    status: "Практика",
    owner: "Методолог",
    updatedAt: "20.05.2026",
    trainingLinks: ["Скрипты", "Чат-тест"],
    items: ["Кредитная история", "Ограничения после завершения", "Повторное банкротство"],
  },
];

export const methodologyStats = {
  chapters: bflMethodologyChapters.length,
  topics: bflMethodologyChapters.reduce((sum, chapter) => sum + chapter.items.length, 0),
  linkedTrainingBlocks: new Set(bflMethodologyChapters.flatMap((chapter) => chapter.trainingLinks)).size,
};
