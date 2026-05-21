// Realistic Russian mock data for HUNTERLITE
export const currentUser = {
  name: "Анна Петрова",
  firstName: "Анна",
  role: "Юрист-консультант",
  email: "a.petrova@hunterlite.ru",
  status: "Допущен" as const,
  avgScore: 82,
  examPassed: true,
  weeklyTrainings: 6,
};

export const topics = [
  "Условия банкротства физического лица",
  "Последствия банкротства",
  "Имущество должника",
  "Процедура и сроки",
  "Стоимость и риски",
  "Возражения клиента",
  "Безопасные формулировки юриста",
  "Ипотечное жильё при банкротстве",
  "Долги, которые не списываются",
];

export const difficulties = ["Базовый", "Средний", "Сложный"] as const;
export const characters = ["Спокойный", "Тревожный", "Сомневающийся", "Недоверчивый", "Конфликтный"] as const;
export const formats = ["Текст", "Голос"] as const;

export const weakTopics = [
  { topic: "Имущество должника", errors: 38, recommendation: "Повторить блок про ипотечное жильё" },
  { topic: "Последствия банкротства", errors: 24, recommendation: "Пройти 3 кейса по ограничениям после процедуры" },
  { topic: "Сроки процедуры", errors: 19, recommendation: "Изучить таймлайн судебного банкротства" },
];

export const notifications = [
  { id: 1, type: "info" as const, title: "Назначен экзамен", text: "Аттестация по теме «Имущество должника» — до 5 мая.", time: "2 часа назад" },
  { id: 2, type: "warning" as const, title: "Рекомендация NAVI", text: "Повторите блок про ипотечное жильё перед экзаменом.", time: "вчера" },
  { id: 3, type: "success" as const, title: "Тренировка завершена", text: "Вы получили 84/100 за сессию «Возражения клиента».", time: "2 дня назад" },
];

export const history = [
  { id: 1, date: "28.04.2026", mode: "Экзамен", topic: "Имущество должника", score: 76, status: "Сдан" },
  { id: 2, date: "27.04.2026", mode: "Тренировка", topic: "Возражения клиента", score: 84, status: "Завершено" },
  { id: 3, date: "26.04.2026", mode: "Чат-тест", topic: "Условия банкротства", score: 91, status: "Завершено" },
  { id: 4, date: "24.04.2026", mode: "Тренировка", topic: "Последствия банкротства", score: 68, status: "Завершено" },
  { id: 5, date: "22.04.2026", mode: "Экзамен", topic: "Сроки процедуры", score: 62, status: "Не сдан" },
];

export const employees = [
  { id: "1", name: "Анна Петрова", score: 84, exam: "Сдан", status: "Допущен", weak: "Имущество, сроки", lastActive: "Сегодня" },
  { id: "2", name: "Иван Смирнов", score: 62, exam: "Не сдан", status: "Не допущен", weak: "Последствия, риски", lastActive: "Вчера" },
  { id: "3", name: "Мария Кузнецова", score: 91, exam: "Сдан", status: "Допущен", weak: "—", lastActive: "Сегодня" },
  { id: "4", name: "Дмитрий Орлов", score: 73, exam: "На проверке", status: "На проверке", weak: "Ипотека", lastActive: "3 дня назад" },
  { id: "5", name: "Елена Новикова", score: 68, exam: "Не сдан", status: "Требуется курс", weak: "Имущество, стоимость", lastActive: "5 дней назад" },
  { id: "6", name: "Сергей Волков", score: 88, exam: "Сдан", status: "Допущен", weak: "Возражения", lastActive: "Сегодня" },
];
