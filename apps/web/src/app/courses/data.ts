/* ─────────────────────────────────────────────────────────────────────────
 * Реестр курсов раздела «Курсы».
 *
 * Обе страницы (обзор /courses и детальная /courses/[slug]) импортируют
 * данные отсюда — единый источник истины.
 *
 * Lesson — один видеоурок:
 *   title       — название урока
 *   description — короткое описание (1–2 строки, опционально)
 *   duration    — длительность (необязательно, напр. "12:30")
 *   cover       — обложка: положите картинку в apps/web/public/courses/
 *                 и впишите путь, напр. "/courses/lesson-1.png".
 *                 Пусто "" → плейсхолдер с номером урока.
 *   url         — ссылка на видео (Я.Диск / VK / RuTube / любая).
 *                 Пусто "" → строка в статусе «Скоро».
 *
 * Course — курс:
 *   slug        — адрес /courses/<slug>
 *   title       — название курса
 *   description — короткое описание для карточки и шапки
 *   paid        — платный ли курс
 *   price       — строка цены (только для платных, напр. "180 000 ₽")
 *   code        — короткий редакторский код для эйброва (напр. "BFL—127")
 *   lessons     — список уроков (может быть пустым → «скоро»)
 * ───────────────────────────────────────────────────────────────────────── */

export interface Lesson {
  title: string;
  description: string;
  duration?: string;
  cover: string;
  url: string;
}

export interface Course {
  slug: string;
  title: string;
  description: string;
  paid: boolean;
  price?: string;
  code: string;
  lessons: Lesson[];
}

export const hasLink = (l: Lesson): boolean =>
  Boolean(l.url && l.url.trim() && l.url !== "#");

/* ── Уроки курса «Юридические аспекты» (перенесены из courses/page.tsx) ──── */
const YURIDICHESKIE_LESSONS: Lesson[] = [
  { title: "Вводное занятие", description: "", duration: "", cover: "/courses/lesson-1.png", url: "https://disk.yandex.ru/i/twn-Zyqw-6m8bQ" },
  { title: "Общие положения о банкротстве граждан", description: "", duration: "", cover: "/courses/lesson-2.png", url: "https://disk.yandex.ru/i/RvJm0Yy3QuawxA" },
  { title: "Основные игроки, их ролевые модели, права и обязанности", description: "", duration: "", cover: "/courses/lesson-3.png", url: "https://disk.yandex.ru/i/Z9bRB26YMjcUFg" },
  { title: "Финансовый управляющий", description: "", duration: "", cover: "/courses/lesson-4.png", url: "https://disk.yandex.ru/i/HpbPSJxCiPvOeg" },
  { title: "Арбитражный суд", description: "", duration: "", cover: "/courses/lesson-5.png", url: "https://disk.yandex.ru/i/f3eegyTCxmvJ9A" },
  { title: "Кредиторы", description: "", duration: "", cover: "/courses/lesson-6.png", url: "https://disk.yandex.ru/i/h9-pnMQALr1R5w" },
  { title: "Виды процедур", description: "", duration: "", cover: "/courses/lesson-7.png", url: "https://disk.yandex.ru/i/Pv6lpzoryi70yw" },
  { title: "Упрощённое банкротство", description: "", duration: "", cover: "/courses/lesson-8.png", url: "https://disk.yandex.ru/i/bTkOj-1WTUTIqA" },
  { title: "Бизнес на банкротстве", description: "", duration: "", cover: "/courses/lesson-9.png", url: "https://disk.yandex.ru/i/2dh-vvi7BXbPnA" },
  { title: "Торги, что подлежит продаже", description: "", duration: "", cover: "/courses/lesson-10.png", url: "https://disk.yandex.ru/i/2lyETvNn0yAUMw" },
  { title: "Оспаривание сделок", description: "", duration: "", cover: "/courses/lesson-11.png", url: "https://disk.yandex.ru/i/LXY8YOsqPSfW6Q" },
  { title: "Взаимодействие с АУ", description: "", duration: "", cover: "/courses/lesson-12.png", url: "https://disk.yandex.ru/i/uCzjGmZKRjpZZQ" },
  { title: "Сбор документов", description: "", duration: "", cover: "/courses/lesson-13.png", url: "https://disk.yandex.ru/i/avyZKTu5tRHSEQ" },
];

export const COURSES: Course[] = [
  {
    slug: "yuridicheskie-aspekty",
    title: "Юридические аспекты",
    description:
      "Полный видеокурс по банкротству физических лиц — от вводного занятия до сбора документов. Игроки процедуры, виды банкротства, торги, оспаривание сделок и работа с АУ.",
    paid: true,
    price: "180 000 ₽",
    code: "BFL—127",
    lessons: YURIDICHESKIE_LESSONS,
  },
  {
    slug: "expertnyi-uroven-bfl",
    title: "Экспертный уровень БФЛ",
    description:
      "Продвинутая программа для практикующих: сложные кейсы, нестандартные процедуры и тонкости защиты интересов доверителя. Записываем уроки — материалы появятся постепенно.",
    paid: true,
    price: "180 000 ₽",
    code: "BFL—EXP",
    lessons: [],
  },
  {
    slug: "soprovozhdenie-bankrotstva",
    title: "Сопровождение процедуры банкротства",
    description:
      "Практическое сопровождение дела от подачи заявления до завершения процедуры. Открытый курс — доступен бесплатно всем пользователям платформы.",
    paid: false,
    code: "BFL—SUP",
    lessons: [],
  },
];

export const getCourse = (slug: string): Course | undefined =>
  COURSES.find((c) => c.slug === slug);
