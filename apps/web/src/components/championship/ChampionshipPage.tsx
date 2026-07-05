"use client";

/**
 * ChampionshipPage — Apple-composition championship/giveaway page.
 *
 * Design decision (CHAMPIONSHIP_PLAN §11): Apple-style layout —
 * huge type, generous whitespace, sticky scroll-storytelling, scroll-linked
 * reveals — but using OUR theme accent (--primary) so it works in light + dark.
 *
 * surface="app"     → embedded inside AuthLayout on /certificate/contest.
 * surface="landing" → standalone section on the public landing (Phase 3).
 *
 * Scroll techniques (Framer Motion, verified against motion.dev):
 *  - useScroll() → scrollYProgress (0→1) bound to a top progress bar (scaleX).
 *  - per-section useScroll({target, offset}) + useTransform for prize reveals.
 *  - whileInView + viewport once for fade/slide-in steps.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, Check, Sparkles, Trophy } from "lucide-react";

import {
  championshipApi,
  seasonLabel,
  type Championship,
  type LeaderboardRow,
  type MyEntry,
  type PrizeItem,
  type WinnerRow,
} from "@/lib/championship";

const BOT_URL = "https://t.me/BFLHUNTER_bot";
const RANK_LABEL = ["Золото", "Серебро", "Бронза"];

// 2026: вместо «серой» цены под устройством показываем профессиональную
// мотивирующую подпись — приз как инструмент успеха в продажах БФЛ, а не
// как ценник. Ключ — тип устройства (та же детекция по имени, что в PrizeMedia).
const PRIZE_TAGLINES: Record<string, { head: string; sub: string }> = {
  macbook: {
    head: "Инструмент тех, кто закрывает больше всех",
    sub: "Ноутбук чемпиона сезона — для лидера в продажах банкротства.",
  },
  iphone: {
    head: "Клиент звонит — вы уже на связи",
    sub: "В банкротстве выигрывает тот, кто отвечает первым.",
  },
  airpods: {
    head: "Услышать клиента — половина сделки",
    sub: "В разговоре о долгах важна каждая деталь.",
  },
};

function prizeTagline(name: string): { head: string; sub: string } | null {
  const n = (name || "").toLowerCase();
  if (n.includes("macbook")) return PRIZE_TAGLINES.macbook;
  if (n.includes("iphone")) return PRIZE_TAGLINES.iphone;
  if (n.includes("airpod")) return PRIZE_TAGLINES.airpods;
  return null;
}

// ─────────────────────────── small helpers ───────────────────────────

function useCountdown(targetIso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return null;
  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

function fmtMoney(v?: number) {
  if (!v) return "";
  return v.toLocaleString("ru-RU") + " ₽";
}

// ─────────────────────────── building blocks ───────────────────────────

function ScrollProgress({ progress }: { progress: MotionValue<number> }) {
  return (
    <motion.div
      aria-hidden
      style={{
        scaleX: progress,
        transformOrigin: "0%",
        position: "sticky",
        top: 0,
        height: 3,
        zIndex: 50,
        background: "var(--primary)",
      }}
    />
  );
}

/** Stylized device line-art (no Apple assets → no copyright risk). */
function DeviceArt({ kind }: { kind: "macbook" | "iphone" | "airpods" | "generic" }) {
  const stroke = "var(--text-primary)";
  const accent = "var(--primary)";
  const common = { fill: "none", stroke, strokeWidth: 6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  if (kind === "macbook") {
    return (
      <svg viewBox="0 0 400 280" className="h-full w-full" style={{ maxHeight: 340 }} aria-hidden>
        <rect x="70" y="40" width="260" height="160" rx="12" {...common} />
        <rect x="92" y="62" width="216" height="116" rx="4" fill={accent} opacity="0.12" stroke="none" />
        <path d="M40 210 h320 l18 26 a8 8 0 0 1 -7 12 H29 a8 8 0 0 1 -7 -12 Z" {...common} />
        <path d="M165 210 h70" stroke={accent} strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "iphone") {
    return (
      <svg viewBox="0 0 200 320" className="h-full w-full" style={{ maxHeight: 360 }} aria-hidden>
        <rect x="50" y="20" width="100" height="280" rx="26" {...common} />
        <rect x="62" y="34" width="76" height="252" rx="16" fill={accent} opacity="0.12" stroke="none" />
        <rect x="84" y="30" width="32" height="10" rx="5" fill={stroke} />
      </svg>
    );
  }
  if (kind === "airpods") {
    return (
      <svg viewBox="0 0 320 260" className="h-full w-full" style={{ maxHeight: 320 }} aria-hidden>
        <rect x="120" y="120" width="80" height="120" rx="20" {...common} />
        <rect x="120" y="120" width="80" height="40" rx="20" fill={accent} opacity="0.14" stroke="none" />
        <path d="M95 40 q-18 0 -18 26 v40 q0 16 16 16 t16 -16 V70 q0 -30 -14 -30 Z" {...common} />
        <path d="M225 40 q18 0 18 26 v40 q0 16 -16 16 t-16 -16 V70 q0 -30 14 -30 Z" {...common} />
      </svg>
    );
  }
  return <Trophy size={64} strokeWidth={1.1} style={{ color: accent }} />;
}

function PrizeVisual({
  prize,
  progress,
  reduced,
}: {
  prize: PrizeItem;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const n = prize.name.toLowerCase();
  const kind: "macbook" | "iphone" | "airpods" | "generic" = n.includes("macbook")
    ? "macbook"
    : n.includes("iphone")
      ? "iphone"
      : n.includes("airpod")
        ? "airpods"
        : "generic";
  const hasImage = !!prize.image && !broken;
  // Scroll-linked «device focus»: a subtle 3D turn + zoom as the prize passes
  // through the viewport (Apple-style product attention). Not a true frame
  // sequence — a full 360° rotation needs a per-device frame set (asset task);
  // this is the honest single-image enhancement we can ship today.
  const rotateY = useTransform(progress, [0, 0.5, 1], [-11, 0, 11]);
  const imgScale = useTransform(progress, [0, 0.5, 1], [1.02, 1.12, 1.04]);
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl p-8 [perspective:1200px]"
      style={{
        minHeight: 300,
        // Apple-style light product tile when a photo is set (фото на светлом фоне →
        // бесшовно в обеих темах); иначе — акцентная плашка с SVG-силуэтом.
        background: hasImage
          ? "#f5f5f7"
          : `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--primary) 14%, var(--surface-card)) 0%, var(--surface-card) 70%)`,
        border: hasImage
          ? "1px solid rgba(0,0,0,0.06)"
          : "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
      }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <motion.img
          src={prize.image}
          alt={prize.name}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
          style={
            reduced
              ? { maxHeight: 360 }
              : {
                  maxHeight: 360,
                  rotateY,
                  scale: imgScale,
                  transformStyle: "preserve-3d",
                  filter: "drop-shadow(0 24px 36px rgba(0,0,0,0.16))",
                }
          }
        />
      ) : (
        <DeviceArt kind={kind} />
      )}
    </div>
  );
}

/** One sticky prize panel that scales/fades in as it scrolls through. */
function PrizeStory({ prize, index }: { prize: PrizeItem; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Softer than a hard 0→1→0 fade so there are no dark dead-zones between prizes.
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1, 0.97]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.45, 1, 1, 0.45]);
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const reversed = index % 2 === 1;
  const tagline = prizeTagline(prize.name);
  return (
    <div ref={ref} className="relative" style={{ minHeight: "38vh" }}>
      <div className="sticky top-[12vh] flex min-h-[28vh] items-center">
        <motion.div
          style={reduced ? undefined : { scale, opacity }}
          className={`grid w-full items-center gap-10 lg:grid-cols-2 ${reversed ? "lg:[direction:rtl]" : ""}`}
        >
          <motion.div style={reduced ? undefined : { y }} className="flex items-center justify-center [direction:ltr]">
            <PrizeVisual prize={prize} progress={scrollYProgress} reduced={!!reduced} />
          </motion.div>
          <div className="[direction:ltr]">
            <div className="font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
              {RANK_LABEL[prize.rank - 1] ?? `Приз ${prize.rank}`} · приз №{prize.rank}
            </div>
            <h3
              className="mt-3 font-semibold tracking-tight"
              style={{ fontSize: "clamp(40px, 6vw, 84px)", lineHeight: 0.98, letterSpacing: "-0.03em", color: "var(--text-primary)" }}
            >
              {prize.name}
            </h3>
            {tagline ? (
              <>
                <p
                  className="mt-5 font-medium"
                  style={{ fontSize: "clamp(18px, 2vw, 22px)", lineHeight: 1.25, color: "var(--text-primary)" }}
                >
                  {tagline.head}
                </p>
                <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
                  {tagline.sub}
                </p>
              </>
            ) : prize.value ? (
              <p className="mt-5 text-lg" style={{ color: "var(--text-secondary)" }}>
                Ориентировочная стоимость приза — {fmtMoney(prize.value)}.
              </p>
            ) : null}
            {prize.value && prize.value > 4000 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                Налогообложение приза (НДФЛ) —{" "}
                <a href="/championship/rules" style={{ color: "var(--primary)" }}>
                  см. Положение
                </a>
                .
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────── main component ───────────────────────────

export default function ChampionshipPage({ surface = "app" }: { surface?: "app" | "landing" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const isLanding = surface === "landing";

  // Hero «тает» и слегка сжимается при выезде вверх (Apple-приём).
  const heroRef = useRef<HTMLDivElement>(null);
  const heroReduced = useReducedMotion();
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroScale = useTransform(heroP, [0, 1], [1, 0.92]);
  const heroOpacity = useTransform(heroP, [0, 1], [1, 0]);

  const [champ, setChamp] = useState<Championship | null>(null);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [me, setMe] = useState<MyEntry | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const cur = await championshipApi.current({ signal: ctrl.signal });
        setChamp(cur.championship);
        setQualifiedCount(cur.qualified_count);
        const tasks: Promise<unknown>[] = [
          championshipApi.winners({ signal: ctrl.signal }).then(setWinners).catch(() => {}),
        ];
        if (cur.championship) {
          tasks.push(
            championshipApi
              .leaderboard(cur.championship.id, { signal: ctrl.signal })
              .then(setLeaderboard)
              .catch(() => {}),
          );
        }
        // me requires auth. On the public landing surface a guest has no token →
        // the api client's 401 handler hard-redirects to /login (window.location),
        // which a .catch() can't prevent. So only fetch /me on the authed app surface.
        if (!isLanding) {
          tasks.push(championshipApi.me({ signal: ctrl.signal }).then(setMe).catch(() => {}));
        }
        await Promise.all(tasks);
      } catch {
        /* network/abort — render graceful empty state */
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const targetIso = champ?.status === "upcoming" ? champ.starts_at : champ?.ends_at;
  const countdownLabel = champ?.status === "upcoming" ? "До старта сезона" : "До конца сезона";
  const cd = useCountdown(targetIso);
  const prizes = champ?.prize_fund ?? [];

  const onEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await championshipApi.enroll();
      setMe(res);
    } catch {
      /* surfaced via api client (auth redirect / toast) */
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <ScrollProgress progress={scrollYProgress} />

      {/* ── HERO ── */}
      <motion.section
        ref={heroRef}
        className="mx-auto max-w-[1100px] px-6 pb-10 pt-[8vh] sm:px-10"
        style={heroReduced ? undefined : { scale: heroScale, opacity: heroOpacity, transformOrigin: "top" }}
      >
        <div className="font-mono text-[12px] uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
          {champ ? `Чемпионат №${champ.number} · ${seasonLabel(champ.season_type)}` : "Чемпионат сезона"}
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-4 font-semibold"
          style={{ fontSize: "clamp(38px, 6.4vw, 92px)", lineHeight: 0.94, letterSpacing: "-0.045em", color: "var(--text-primary)", hyphens: "none", WebkitHyphens: "none" }}
        >
          {(() => {
            const parts = (champ?.title ?? "Чемпионат сезона").split("·").map((s) => s.trim());
            // Ровно 2 строки: «Чемпионат сезона» / «Лето–Осень 2026». Обе — nowrap,
            // чтобы «сезона» не уезжало на отдельную строку, а дата не ломалась дефисом.
            return parts.length > 1 ? (
              <>
                <span style={{ whiteSpace: "nowrap" }}>{parts[0]}</span>
                <br />
                <span style={{ whiteSpace: "nowrap" }}>{parts.slice(1).join(" · ")}</span>
              </>
            ) : (
              parts[0]
            );
          })()}
        </motion.h1>
        <p className="mt-6 max-w-2xl text-xl leading-snug" style={{ color: "var(--text-secondary)" }}>
          Розыгрыш призов Apple среди аттестованных экспертов. Выполните условия участия до конца сезона —
          и попадёте в розыгрыш.
        </p>

        {/* countdown + CTA */}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          {cd && (
            <div className="flex items-center gap-3">
              {[
                [cd.d, "дн"],
                [cd.h, "ч"],
                [cd.m, "мин"],
                [cd.s, "сек"],
              ].map(([val, lbl]) => (
                <div key={lbl as string} className="text-center">
                  <div
                    className="font-mono text-3xl font-semibold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {String(val).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {lbl as string}
                  </div>
                </div>
              ))}
              <div className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{countdownLabel}</div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {!isLanding && me?.enrolled ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
            >
              <Check size={16} /> Вы участвуете в розыгрыше
            </span>
          ) : (
            <button
              onClick={isLanding ? () => router.push("/register") : onEnroll}
              disabled={enrolling || champ?.status === "finished"}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-transform hover:scale-[1.02] disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
            >
              {isLanding ? "Начать участвовать" : enrolling ? "Отправляем…" : "Участвовать в розыгрыше"}{" "}
              <ArrowRight size={18} />
            </button>
          )}
          {champ && (
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Квалифицировано участников: <b style={{ color: "var(--text-secondary)" }}>{qualifiedCount}</b>
            </span>
          )}
        </div>
      </motion.section>

      {/* ── PRIZES (sticky storytelling) ── */}
      {prizes.length > 0 && (
        <section className="mx-auto max-w-[1100px] px-6 py-[4vh] sm:px-10">
          <Reveal>
            <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              01 · Призовой фонд
            </div>
            <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 64px)", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
              Три приза. Одна цель — стать лучшим.
            </h2>
          </Reveal>
          <div className="mt-6">
            {prizes.map((p, i) => (
              <PrizeStory key={p.rank} prize={p} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ── HOW TO ENTER ── */}
      <section className="mx-auto max-w-[1100px] px-6 py-[4vh] sm:px-10">
        <Reveal>
          <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            02 · Как участвовать
          </div>
          <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 64px)", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            Четыре шага до розыгрыша.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            { t: "Сдайте аттестацию", n: "Все экзамены на ≥ 88% — получите именной сертификат.", done: me?.criteria?.exam_passed, href: undefined as string | undefined },
            { t: "Пройдите курсы", n: "«Юридические аспекты» и «Экспертный уровень БФЛ».", done: me?.criteria?.courses_done, href: undefined },
            { t: "Оставьте отзыв", n: "Поделитесь опытом на странице отзывов — это одно из условий участия.", done: me?.criteria?.review_left, href: "/reviews" },
            { t: "Подайте заявку", n: "Нажмите «Участвовать» — и вы в пуле розыгрыша.", done: me?.enrolled, href: undefined },
          ].map((step, i) => {
            const card = (
              <div
                className="flex h-full items-start gap-4 rounded-2xl p-6 transition-colors"
                style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={
                    step.done
                      ? { background: "var(--primary)", color: "var(--primary-contrast, #fff)" }
                      : { background: "var(--bg-secondary)", color: "var(--text-muted)" }
                  }
                >
                  {step.done ? <Check size={16} /> : i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {step.t}
                    {step.href ? <ArrowRight size={15} style={{ color: "var(--primary)" }} /> : null}
                  </div>
                  <div className="mt-1 text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>{step.n}</div>
                </div>
              </div>
            );
            return (
              <Reveal key={step.t} delay={i * 0.05}>
                {step.href ? (
                  <Link href={step.href} className="block no-underline">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── QUALIFIED POOL / LEADERBOARD ── */}
      <section className="mx-auto max-w-[1100px] px-6 py-[4vh] sm:px-10">
        <Reveal>
          <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            03 · Пул участников
          </div>
          <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.02, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Кто уже в игре.
          </h2>
        </Reveal>
        <div className="mt-8 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border-color)" }}>
          {leaderboard.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {loading ? "Загрузка…" : "Пока никто не подал заявку — станьте первым."}
            </div>
          ) : (
            leaderboard.map((row, i) => (
              <div
                key={`${row.name}-${row.rank}`}
                className="flex items-center justify-between px-6 py-4"
                style={{ background: i % 2 ? "var(--bg-secondary)" : "var(--surface-card)", borderTop: i ? "1px solid var(--border-color)" : undefined }}
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 font-mono text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{row.rank}</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{row.name}</span>
                </div>
                <span className="font-mono text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>{Math.round(row.score)}</span>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Список квалифицированных участников. Победители определяются розыгрышем среди всех, кто выполнил условия —
          не по месту в списке.
        </p>
      </section>

      {/* ── WINNERS HISTORY ── */}
      <section className="mx-auto max-w-[1100px] px-6 py-[4vh] sm:px-10">
        <Reveal>
          <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            04 · История победителей
          </div>
          <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.02, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Зал славы чемпионов.
          </h2>
        </Reveal>
        {winners.length === 0 ? (
          <div
            className="mt-8 flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center"
            style={{ border: "1px dashed var(--border-color)" }}
          >
            <Sparkles size={28} style={{ color: "var(--primary)" }} />
            <div className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Здесь появятся имена первых чемпионов
            </div>
            <div className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
              Идёт первый сезон. После подведения итогов победители навсегда останутся в этом зале.
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {winners.map((w) => (
              <div
                key={`${w.championship_number}-${w.rank}`}
                className="flex items-center justify-between rounded-2xl px-6 py-4"
                style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--primary)" }}>
                    {RANK_LABEL[w.rank - 1] ?? `#${w.rank}`}
                  </span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{w.name}</span>
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {w.prize} · Чемпионат №{w.championship_number}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── DOCUMENTS / FOOTER ── */}
      <section id="contest-documents" className="mx-auto max-w-[1100px] px-6 py-[4vh] sm:px-10">
        <Reveal>
          <div className="rounded-3xl p-8 sm:p-12" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <div className="font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Документы и условия
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Прозрачные правила
            </h2>
            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2" style={{ color: "var(--text-secondary)" }}>
              <li>• Мероприятие стимулирующее (ст. 9 ФЗ-38 «О рекламе»), не лотерея. Плата за участие не взимается.</li>
              <li>• Победители определяются розыгрышем среди квалифицированных участников; результат фиксируется.</li>
              <li>• С приза дороже 4 000 ₽ уплачивается НДФЛ 35% с суммы превышения (ст. 224, 217 НК РФ). Приз неденежный — налог декларирует победитель.</li>
              <li>• Публикация имени/фото победителя — только с отдельного согласия (ст. 10.1 152-ФЗ).</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/championship/rules"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
              >
                Положение о Чемпионате
              </a>
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
              >
                Задать вопрос в Telegram
              </a>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Организатор: ООО «АСПБ» · ИНН 6452098049 · ОГРН 1126450005406
              </span>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
