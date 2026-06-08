"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";

/* ══════════════════════════════════════════════════════════════════
   РЕДАКТИРУЕМЫЕ ДАННЫЕ СЕЗОНА
   ──────────────────────────────────────────────────────────────────
   Это ЕДИНСТВЕННОЕ место, которое нужно править под новый сезон.
   Меняйте текст / даты / призовые места / правила прямо здесь —
   вёрстка подстроится сама.
   ══════════════════════════════════════════════════════════════════ */
const CONTEST = {
  /* Короткий код сезона для mono-эйброва, напр. «Сезон I · 2026» */
  seasonLabel: "Сезон I · 2026",
  /* Заголовок страницы (крупный display) */
  title: "Чемпионат сезона",
  /* Подзаголовок — одна спокойная строка-описание */
  subtitle:
    "Розыгрыш приза среди аттестованных экспертов. Сдайте аттестацию до конца сезона — это вход в чемпионат.",

  /* ── ГЛАВНЫЙ ПРИЗ (большой редакторский герой) ── */
  prize: "MacBook Air", //  напр. «MacBook Air» / «100 000 ₽»
  prizeKicker: "Главный приз сезона", // мелкий эйбров над призом
  prizeNote: "Разыгрывается среди всех аттестованных за сезон — один победитель.",

  /* ── ПЕРИОД И ПАРАМЕТРЫ ── */
  periodStart: "1 июня 2026",
  periodEnd: "31 августа 2026",
  passThreshold: "≥ 88%", // порог сдачи для входа в чемпионат
  prizePlaces: 3, // число призовых мест на подиуме

  /* ── ПОДИУМ ──
     Монохром + акцент. БЕЗ «золото/серебро/бронза».
     Порядок в массиве = места 1·2·3. */
  podium: [
    { place: 1, title: "Гран-при", note: "макс. балл + скорость" },
    { place: 2, title: "Серебро сезона", note: "приз чемпионата" },
    { place: 3, title: "Бронза сезона", note: "приз чемпионата" },
  ],

  /* ── ЛИДЕРБОРД ──
     Placeholder. Позже можно заменить на live-данные из API. */
  leaderboard: [
    { rank: 1, name: "А. Смирнова", score: 98, speed: "2 дн" },
    { rank: 2, name: "И. Петров", score: 96, speed: "3 дн" },
    { rank: 3, name: "М. Кузнецов", score: 95, speed: "3 дн" },
    { rank: 4, name: "Д. Орлова", score: 93, speed: "4 дн" },
    { rank: 5, name: "С. Волков", score: 91, speed: "5 дн" },
  ],

  /* ── ПРАВИЛА ── */
  rules: [
    "Сдайте аттестацию — все экзамены на ≥ 88% — до конца сезона. Это вход в чемпионат.",
    "Топ-3 по сумме баллов и скорости сдачи получают призы чемпионата.",
    "Среди всех аттестованных за сезон дополнительно разыгрывается главный приз.",
    "Победители объявляются в Telegram-канале и по e-mail после завершения сезона.",
  ],
};

/* Тихий факт спецификации: mono-эйбров сверху, значение снизу. */
function SpecRow({ code, label, value }: { code: string; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <div className="min-w-0">
        <div
          className="font-mono uppercase tabular-nums"
          style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)" }}
        >
          {code}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {label}
        </div>
      </div>
      <div
        className="shrink-0 text-right font-mono text-[14px] font-semibold tabular-nums"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut" as const, delay },
});

export default function ContestPage() {
  const router = useRouter();

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[960px] px-5 py-8 sm:px-8 sm:py-12">
          {/* ── back to certificate ── */}
          <button
            onClick={() => router.push("/certificate")}
            className="mb-8 inline-flex items-center gap-2 font-mono uppercase transition-opacity hover:opacity-70"
            style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={14} />
            Сертификат
          </button>

          {/* ── editorial hero ── */}
          <motion.div {...fade(0)}>
            <EditorialHeader
              eyebrowLeft={`Чемпионат · ${CONTEST.seasonLabel}`}
              eyebrowRight="Розыгрыш приза"
              title={CONTEST.title}
              subtitle={CONTEST.subtitle}
            />
          </motion.div>

          {/* ── PRIZE HERO + SPEC SHEET ──────────────────────────────
              Левая колонка — крупный приз; правая — спецификация сезона. */}
          <motion.section
            {...fade(0.06)}
            className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-2xl)] lg:grid-cols-[1fr_300px]"
            style={{ background: "var(--border-color)", boxShadow: "var(--shadow-md)" }}
          >
            {/* prize hero */}
            <div
              className="relative flex flex-col justify-between p-7 sm:p-9"
              style={{ background: "var(--surface-card)", minHeight: 280 }}
            >
              <span
                aria-hidden
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--primary)" }}
              />
              <div className="flex items-center justify-between gap-4">
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--primary)" }}
                >
                  {CONTEST.prizeKicker}
                </span>
                <span
                  className="font-mono uppercase tabular-nums"
                  style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
                >
                  00 · ПРИЗ
                </span>
              </div>

              <div className="mt-10">
                <div
                  className="font-display"
                  style={{
                    fontSize: "clamp(40px, 7vw, 76px)",
                    lineHeight: 0.94,
                    letterSpacing: "-0.045em",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {CONTEST.prize}
                </div>
                <p
                  className="mt-5 text-[14px] leading-relaxed"
                  style={{ color: "var(--text-secondary)", maxWidth: 440 }}
                >
                  {CONTEST.prizeNote}
                </p>
              </div>
            </div>

            {/* spec sheet */}
            <div className="flex flex-col px-7 py-3 sm:px-8" style={{ background: "var(--bg-secondary)" }}>
              <SpecRow code="ST · СТАРТ" label="Открытие сезона" value={CONTEST.periodStart} />
              <div className="h-px w-full" style={{ background: "var(--border-color)" }} />
              <SpecRow code="EN · ФИНИШ" label="Закрытие сезона" value={CONTEST.periodEnd} />
              <div className="h-px w-full" style={{ background: "var(--border-color)" }} />
              <SpecRow code="EX · ВХОД" label="Порог аттестации" value={CONTEST.passThreshold} />
              <div className="h-px w-full" style={{ background: "var(--border-color)" }} />
              <SpecRow code="PL · МЕСТА" label="Призовых мест" value={`${CONTEST.prizePlaces} + розыгрыш`} />
            </div>
          </motion.section>

          {/* ── PODIUM ───────────────────────────────────────────────
              Монохром + акцент. Первое место — заливка акцентом,
              второе/третье — приглушённый акцент и хайрлайн. */}
          <motion.section {...fade(0.1)} className="mt-16">
            <SectionHeader code="01 · ПОДИУМ" title="Три призовых места" />
            <div
              className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius-2xl)] sm:grid-cols-3"
              style={{ background: "var(--border-color)", border: "1px solid var(--border-color)" }}
            >
              {[CONTEST.podium[0], CONTEST.podium[1], CONTEST.podium[2]].map((p) => {
                const lead = p.place === 1;
                return (
                  <div
                    key={p.place}
                    className="relative flex flex-col gap-7 p-6 sm:p-7"
                    style={{ background: lead ? "var(--primary-muted)" : "var(--surface-card)", minHeight: 168 }}
                  >
                    {lead && (
                      <span
                        aria-hidden
                        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--primary)" }}
                      />
                    )}
                    <div className="flex items-start justify-between">
                      <span
                        className="font-display tabular-nums"
                        style={{
                          fontSize: 52,
                          lineHeight: 0.8,
                          letterSpacing: "-0.04em",
                          fontWeight: 600,
                          color: lead ? "var(--primary)" : "var(--text-muted)",
                        }}
                      >
                        {String(p.place).padStart(2, "0")}
                      </span>
                      <span
                        className="font-mono uppercase tabular-nums"
                        style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--text-muted)" }}
                      >
                        {lead ? "GRAND" : "PRIZE"}
                      </span>
                    </div>
                    <div className="mt-auto">
                      <div
                        className="text-[16px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.title}
                      </div>
                      <div
                        className="mt-1 font-mono text-[11px]"
                        style={{ color: lead ? "var(--primary)" : "var(--text-muted)" }}
                      >
                        {p.note}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* ── LEADERBOARD ──────────────────────────────────────────
              Спецификация-таблица: тонкие линейки, mono tabular-nums. */}
          <motion.section {...fade(0.14)} className="mt-16">
            <SectionHeader
              code="02 · ТЕКУЩИЙ РЕЙТИНГ"
              title="Лидеры сезона"
              right={
                <span
                  className="hidden font-mono uppercase tabular-nums sm:inline-flex"
                  style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)" }}
                >
                  балл · скорость
                </span>
              }
            />
            <Card className="mt-6" padded={false}>
              {/* header row */}
              <div
                className="hidden items-center gap-4 px-5 py-3 sm:flex sm:px-7"
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <span
                  className="w-8 font-mono uppercase tabular-nums"
                  style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-muted)" }}
                >
                  №
                </span>
                <span
                  className="min-w-0 flex-1 font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-muted)" }}
                >
                  Эксперт
                </span>
                <span
                  className="w-12 text-right font-mono uppercase tabular-nums"
                  style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-muted)" }}
                >
                  Балл
                </span>
                <span
                  className="w-16 text-right font-mono uppercase tabular-nums"
                  style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-muted)" }}
                >
                  Срок
                </span>
              </div>

              <div className="flex flex-col">
                {CONTEST.leaderboard.map((row, i) => {
                  const top3 = row.rank <= 3;
                  return (
                    <div
                      key={row.rank}
                      className="flex items-center gap-4 px-5 py-4 sm:px-7"
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-color)" }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-semibold tabular-nums"
                        style={{
                          background: top3 ? "var(--primary-muted)" : "transparent",
                          color: top3 ? "var(--primary)" : "var(--text-muted)",
                          border: top3 ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                        }}
                      >
                        {row.rank}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate text-[15px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.name}
                      </span>
                      <span
                        className="w-12 shrink-0 text-right font-mono text-[14px] font-semibold tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.score}%
                      </span>
                      <span
                        className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {row.speed}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
            <p className="mt-3 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              Рейтинг обновляется по мере сдачи аттестаций. Данные — предварительные.
            </p>
          </motion.section>

          {/* ── RULES ────────────────────────────────────────────────
              Спецификация участия: нумерованные строки в grid-сетке. */}
          <motion.section {...fade(0.18)} className="mt-16">
            <SectionHeader code="03 · ПРАВИЛА" title="Как участвовать" />
            <div
              className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius-2xl)] sm:grid-cols-2"
              style={{ background: "var(--border-color)", border: "1px solid var(--border-color)" }}
            >
              {CONTEST.rules.map((r, i) => (
                <div key={i} className="flex gap-5 p-6 sm:p-7" style={{ background: "var(--surface-card)" }}>
                  <span
                    className="font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color: "var(--primary)", paddingTop: 1 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {r}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── CTA ──────────────────────────────────────────────────*/}
          <motion.section {...fade(0.22)} className="mt-16">
            <Card
              accentTop
              className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div
                  className="font-mono uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--primary)" }}
                >
                  Вход в чемпионат
                </div>
                <h3
                  className="mt-3 text-2xl font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Готовы побороться за приз?
                </h3>
                <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
                  Сдайте аттестацию до {CONTEST.periodEnd} — и войдите в чемпионат.
                </p>
              </div>
              <Button
                href="/exam"
                variant="primary"
                size="lg"
                fluid
                iconRight={<ArrowRight size={16} />}
                className="shrink-0 sm:w-auto"
              >
                Участвовать
              </Button>
            </Card>
          </motion.section>
        </div>
      </div>
    </AuthLayout>
  );
}
