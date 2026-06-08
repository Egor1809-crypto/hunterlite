"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight, Play, Lock } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";

/* ─────────────────────────────────────────────────────────────────────────
 * КУРСЫ — 13 уроков. Заполните каждый объект:
 *   title       — название урока
 *   description — короткое описание (1–2 строки, опционально)
 *   duration    — длительность (необязательно, напр. "12:30")
 *   cover       — обложка: положите картинку в apps/web/public/courses/
 *                 и впишите путь, напр. "/courses/lesson-1.jpg".
 *                 Пусто "" → плейсхолдер с номером урока.
 *   url         — ссылка на видео (Я.Диск / VK / RuTube / любая).
 *                 Пусто "" → строка в статусе «Скоро».
 * ───────────────────────────────────────────────────────────────────────── */
interface Lesson {
  title: string;
  description: string;
  duration?: string;
  cover: string;
  url: string;
}

const LESSONS: Lesson[] = [
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

const hasLink = (l: Lesson) => Boolean(l.url && l.url.trim() && l.url !== "#");

/* ── Один урок = редакторская строка индекса (malvah-style) ────────────────
 * Большой mono-номер · название · тонкая обложка-превью справа · CTA-стрелка.
 * Разделение — hairline, не коробки. Воздух важнее бордюров.
 * ─────────────────────────────────────────────────────────────────────── */
function LessonRow({ lesson, index }: { lesson: Lesson; index: number }) {
  const live = hasLink(lesson);
  const num = String(index + 1).padStart(2, "0");

  const inner = (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 py-6 sm:gap-8 sm:py-7">
      {/* № урока — крупный mono, тихий, акцент на hover у живых уроков */}
      <span
        className="font-mono tabular-nums transition-colors"
        style={{
          fontSize: "clamp(28px, 4.5vw, 44px)",
          lineHeight: 1,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: live ? "var(--text-muted)" : "var(--border-color)",
          width: "clamp(46px, 7vw, 72px)",
        }}
      >
        {num}
      </span>

      {/* Заголовок + классификатор */}
      <div className="min-w-0">
        <div
          className="flex items-center gap-2 font-mono uppercase"
          style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "var(--text-muted)" }}
        >
          <span>Урок {num}</span>
          {lesson.duration && (
            <>
              <span style={{ color: "var(--border-color)" }}>·</span>
              <span className="tabular-nums">{lesson.duration}</span>
            </>
          )}
          {!live && (
            <>
              <span style={{ color: "var(--border-color)" }}>·</span>
              <span>скоро</span>
            </>
          )}
        </div>
        <h3
          className="mt-2 line-clamp-2 font-display"
          style={{
            fontSize: "clamp(18px, 2.6vw, 26px)",
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            fontWeight: 600,
            color: live ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          {lesson.title}
        </h3>
        {lesson.description && (
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {lesson.description}
          </p>
        )}
      </div>

      {/* Превью-обложка (раскрывается мягче на hover) + индикатор действия */}
      <div className="flex items-center gap-4">
        <div
          className="relative hidden overflow-hidden sm:block"
          style={{
            width: "clamp(96px, 13vw, 152px)",
            aspectRatio: "16 / 9",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
          }}
        >
          {lesson.cover ? (
            <Image
              src={lesson.cover}
              alt={lesson.title}
              width={304}
              height={171}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              style={{ filter: live ? "none" : "grayscale(1)", opacity: live ? 1 : 0.55 }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-sm" style={{ color: "var(--text-muted)" }}>
              {num}
            </div>
          )}
          {live && (
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "color-mix(in srgb, var(--text-primary) 30%, transparent)" }}
            >
              <span
                className="flex items-center justify-center rounded-full backdrop-blur-sm"
                style={{ width: 36, height: 36, background: "color-mix(in srgb, var(--primary) 92%, transparent)" }}
              >
                <Play size={15} className="ml-0.5" style={{ color: "var(--primary-contrast, #fff)" }} fill="currentColor" />
              </span>
            </span>
          )}
        </div>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300"
          style={{
            border: `1px solid ${live ? "var(--border-color)" : "var(--border-color)"}`,
            color: live ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          {live ? (
            <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          ) : (
            <Lock size={13} />
          )}
        </span>
      </div>
    </div>
  );

  const rowStyle = { borderTop: index === 0 ? "none" : "1px solid var(--border-color)" } as const;

  return live ? (
    <a
      href={lesson.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block transition-colors"
      style={rowStyle}
    >
      {inner}
    </a>
  ) : (
    <div className="group block cursor-default" style={rowStyle}>
      {inner}
    </div>
  );
}

export default function CoursesPage() {
  const liveCount = LESSONS.filter(hasLink).length;

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[920px] px-5 py-8 sm:px-8 sm:py-12">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: "easeOut" }}>
            <EditorialHeader
              eyebrowLeft="Обучение · Видеокурс"
              eyebrowRight={`${String(LESSONS.length).padStart(2, "0")} уроков · ${liveCount} доступно`}
              title="Курсы"
              subtitle="Полный видеокурс по банкротству физических лиц — от вводного занятия до сбора документов. Открывайте уроки по порядку."
            />
          </motion.div>

          {/* Индекс курса — редакторский список, не библиотека-сетка */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.06 }}
            className="mt-12 sm:mt-16"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}>
                01 · Программа курса
              </span>
              <span className="font-mono uppercase tabular-nums" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}>
                BFL—127
              </span>
            </div>

            <div className="flex flex-col" style={{ borderBottom: "1px solid var(--border-color)" }}>
              {LESSONS.map((lesson, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(0.08 + i * 0.025, 0.34), duration: 0.26, ease: "easeOut" }}
                >
                  <LessonRow lesson={lesson} index={i} />
                </motion.div>
              ))}
            </div>

            <p className="mt-5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              Видео открываются по внешней ссылке. Уроки в статусе «скоро» появятся по мере записи.
            </p>
          </motion.section>
        </div>
      </div>
    </AuthLayout>
  );
}
