"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

import { useNotificationStore } from "@/stores/useNotificationStore";
import { Loader2, Lock, MessageCircle, Phone, ChevronLeft, ArrowRight, Users, SearchX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnboardingHint } from "@/components/ui/OnboardingHint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { api, ApiError } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────
//
// Конструктор v3 (CONSTRUCTOR_TZ, 2026-06-04): 100 архетипов + 8-шаговый wizard
// заменены галереей 25 готовых reference-персонажей. Источник истины — таблица
// reference_personas (засеяна 25 шт.). GET /characters/reference отдаёт карточки;
// механика персонажа (его поля + cached_dossier через persona_brief) ведёт
// AI-клиента. Гейт разблокировки региона 1 теста сохранён без изменений.

interface CharacterBuilderProps {
  onGoToTests?: () => void;
}

type Difficulty = "easy" | "medium" | "hard";

interface ReferencePersona {
  slug: string;
  name: string;
  archetype: string | null;
  archetype_label: string;
  profession: string | null;
  lead_source: string | null;
  debt_stage: string | null;
  debt_range: string | null;
  family_preset: string | null;
  creditors_preset: string | null;
  property_preset: string | null;
  emotion_preset: string | null;
  difficulty: Difficulty | string;
  environment: string | null;
  tone: string | null;
  client_brief: string;
  lawyer_brief: string;
}

// ─── Difficulty chip presentation ────────────────────────────────────────────
// Нейтральная палитра + один акцент. Сложность — единственный цветовой сигнал
// в карточке, и тот сдержанный (мьютед фон, контурный текст).

const DIFFICULTY_META: Record<string, { label: string; tone: string; bg: string }> = {
  easy: { label: "Просто", tone: "var(--success)", bg: "var(--success-muted)" },
  medium: { label: "Средне", tone: "var(--warning)", bg: "var(--warning-muted)" },
  hard: { label: "Сложно", tone: "var(--danger)", bg: "var(--danger-muted)" },
};

function difficultyMeta(code: string) {
  return DIFFICULTY_META[code] ?? { label: code, tone: "var(--text-muted)", bg: "var(--input-bg)" };
}

// Русское склонение по числу: plural(n, "клиент", "клиента", "клиентов").
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// Короткая ситуация для карточки: предпочитаем диапазон долга, иначе — первую
// строку client_brief. Без юридического жаргона, одна строка.
function shortSituation(p: ReferencePersona): string {
  if (p.debt_range && p.debt_range.trim()) return `Долг ${p.debt_range}`;
  const firstLine = (p.client_brief || "").split("\n").map((s) => s.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 90) : "";
}

const EMOTION_RU: Record<string, string> = {
  neutral: "Нейтральный",
  anxious: "Тревожный",
  angry: "Злой",
  hopeful: "Надеющийся",
  tired: "Уставший",
  rushed: "Спешащий",
  trusting: "Доверчивый",
};

function emotionLabel(code: string | null): string {
  if (!code) return "";
  return EMOTION_RU[code] ?? code;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CharacterBuilder({ onGoToTests }: CharacterBuilderProps) {
  const router = useRouter();

  // ── Region-1 unlock gate (сохранено из v2) ──
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [unlockHint, setUnlockHint] = useState<string>("");
  useEffect(() => {
    api.get("/training-map/progress")
      .then((d: { constructor_unlocked?: boolean; constructor_unlock_hint?: string | null }) => {
        setUnlocked(!!d.constructor_unlocked);
        setUnlockHint(d.constructor_unlock_hint || "");
      })
      .catch(() => setUnlocked(true)); // fail-open: транзиентная ошибка не блокирует практику (бэкенд энфорсит 403)
  }, []);

  // ── Gallery state ──
  const [personas, setPersonas] = useState<ReferencePersona[] | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | null>(null);
  const [archetypeFilter, setArchetypeFilter] = useState<string | null>(null);
  const [startingMode, setStartingMode] = useState<"chat" | "call" | null>(null);

  useEffect(() => {
    if (unlocked !== true) return;
    let cancelled = false;
    api.get("/characters/reference")
      .then((d: { personas?: ReferencePersona[] }) => {
        if (cancelled) return;
        setPersonas(Array.isArray(d.personas) ? d.personas : []);
      })
      .catch((err) => {
        if (cancelled) return;
        // Гейт мог пропустить fail-open на маунте — бэкенд закрыл 403 здесь.
        if (
          err instanceof ApiError &&
          err.status === 403 &&
          err.detail &&
          (err.detail as { code?: string }).code === "constructor_locked"
        ) {
          setUnlockHint((err.detail as { message?: string }).message || "");
          setUnlocked(false);
          return;
        }
        logger.error("Failed to load reference personas:", err);
        setLoadError(err instanceof Error ? err.message : "Не удалось загрузить персонажей");
        setPersonas([]);
      });
    return () => { cancelled = true; };
  }, [unlocked]);

  const selected = useMemo(
    () => personas?.find((p) => p.slug === selectedSlug) ?? null,
    [personas, selectedSlug],
  );

  // Уникальные архетип-метки для фильтра (опционально).
  const archetypeOptions = useMemo(() => {
    if (!personas) return [];
    const seen = new Map<string, string>();
    for (const p of personas) {
      if (p.archetype && p.archetype_label && !seen.has(p.archetype)) {
        seen.set(p.archetype, p.archetype_label);
      }
    }
    return Array.from(seen.entries()).map(([code, label]) => ({ code, label }));
  }, [personas]);

  const filtered = useMemo(() => {
    if (!personas) return [];
    return personas.filter((p) => {
      if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
      if (archetypeFilter && p.archetype !== archetypeFilter) return false;
      return true;
    });
  }, [personas, difficultyFilter, archetypeFilter]);

  // ── Start a session from the chosen reference persona ──
  // sessionMode=call → телефонный UI; chat → текстовый чат. Бэкенд получает
  // mode + custom_session_mode и грузит персонажа по reference_persona_slug,
  // строя custom_params (включая persona_brief = client_brief → досье в AI).
  const handleStart = async (sessionMode: "chat" | "call") => {
    if (!selected) return;
    setStartingMode(sessionMode);
    try {
      const session = await api.post("/training/sessions", {
        reference_persona_slug: selected.slug,
        mode: sessionMode,
        custom_session_mode: sessionMode,
      });
      const targetPath = sessionMode === "call"
        ? `/training/${session.id}/call`
        : `/training/${session.id}`;
      router.push(targetPath);
    } catch (err) {
      logger.error("Failed to start:", err);
      // 409 — уже идёт тренировка: открываем её, а не упираемся в тупик.
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.detail &&
        (err.detail as { code?: string }).code === "session_already_active"
      ) {
        const existingId = (err.detail as { existing_session_id?: string }).existing_session_id;
        if (typeof existingId === "string" && existingId.length > 0) {
          useNotificationStore.getState().addToast({
            title: "Активная тренировка",
            body: "У тебя уже идёт тренировка — открываю её.",
            type: "info",
          });
          const target = sessionMode === "call"
            ? `/training/${existingId}/call`
            : `/training/${existingId}`;
          setTimeout(() => router.push(target), 600);
          return;
        }
      }
      // 403 constructor_locked — перерендерим заглушку «Практика закрыта».
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.detail &&
        (err.detail as { code?: string }).code === "constructor_locked"
      ) {
        setUnlockHint((err.detail as { message?: string }).message || "");
        setUnlocked(false);
        setStartingMode(null);
        return;
      }
      useNotificationStore.getState().addToast({
        title: "Ошибка",
        body: err instanceof Error ? err.message : "Не удалось создать сессию",
        type: "error",
      });
      setStartingMode(null);
    }
  };

  // ─── Render: loading gate ───
  if (unlocked === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin" size={24} style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  // ─── Render: locked ───
  if (!unlocked) {
    return (
      <EmptyState
        icon={Lock}
        title="Практика пока закрыта"
        description={unlockHint || "Пройдите регион «Условия подачи» (10 уровней теста), чтобы открыть практику с клиентом."}
        actionLabel="Перейти к тестам"
        onAction={() => { if (onGoToTests) onGoToTests(); else router.push("/training?tab=tests"); }}
      />
    );
  }

  // ─── Render: gallery loading ───
  if (personas === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin" size={24} style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  // ─── Render: preview (a persona is selected) ───
  if (selected) {
    const dm = difficultyMeta(selected.difficulty);
    return (
      <div className="mt-8 mx-auto max-w-3xl">
        <button
          onClick={() => setSelectedSlug(null)}
          className="mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-opacity hover:opacity-60"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={14} />
          Все клиенты
        </button>

        <div
          className="rounded-2xl p-8 sm:p-10"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Имя крупно, мета мелко и приглушённо — контраст масштаба. */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] mb-3" style={{ color: "var(--text-muted)" }}>
                Досье клиента
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {selected.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {selected.archetype_label && <span>{selected.archetype_label}</span>}
                {selected.profession && <><span aria-hidden>·</span><span>{selected.profession}</span></>}
                {emotionLabel(selected.emotion_preset) && (
                  <><span aria-hidden>·</span><span>{emotionLabel(selected.emotion_preset)}</span></>
                )}
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: dm.tone }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dm.tone }} aria-hidden />
              {dm.label}
            </span>
          </div>

          {/* Кто / ситуация */}
          {selected.client_brief && (
            <div className="mt-8 pt-8" style={{ borderTop: "1px solid var(--border-color)" }}>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--text-muted)" }}>
                Кто перед вами
              </div>
              <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                {selected.client_brief}
              </p>
            </div>
          )}

          {/* На что обратить внимание (тренировочная подсказка юристу) */}
          {selected.lawyer_brief && (
            <div className="relative mt-6 overflow-hidden rounded-xl p-5 sm:p-6" style={{ background: "var(--bg-secondary)" }}>
              <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ background: "var(--accent)" }} />
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--accent)" }}>
                На что обратить внимание
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                {selected.lawyer_brief}
              </p>
            </div>
          )}

          {/* Действия — единая иерархия: чат основной (filled), звонок
              второстепенный (outlined). Подпись поясняет разницу режимов. */}
          <div className="mt-9">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={() => handleStart("chat")}
                disabled={startingMode !== null}
                loading={startingMode === "chat"}
                icon={<MessageCircle size={16} />}
              >
                Начать чат
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStart("call")}
                disabled={startingMode !== null}
                loading={startingMode === "call"}
                icon={<Phone size={16} />}
              >
                Позвонить
              </Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Чат — текстовая консультация в своём темпе. Звонок — голосовой разговор в реальном времени.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: gallery grid ───
  return (
    <div className="mt-8">
      {/* Заголовок-интро: whitespace-first, editorial-типографика. */}
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] mb-3" style={{ color: "var(--text-muted)" }}>
          Практика · {personas.length} клиент{plural(personas.length, "", "а", "ов")}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
          Мои клиенты
        </h1>
        <p className="mt-3 max-w-xl text-sm sm:text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Подберите должника и проведите консультацию по ФЗ-127 — в чате или по звонку.
        </p>
      </div>

      {/* Онбординг «как пользоваться»: при первом заходе развёрнут, дальше
          сворачивается в «i» и сам не выскакивает (запоминается в localStorage). */}
      <OnboardingHint
        id="my-clients-guide"
        eyebrow="Как это работает"
        title="Тренажёр приёма должника"
        intro="Каждая карточка — это живой клиент со своим делом о банкротстве физлица (ФЗ-127). ИИ отыгрывает его характер и держится фактов его ситуации. Вы — юрист на консультации: ваша задача провести приём грамотно, а не «продать» услугу."
        steps={[
          {
            title: "Выберите клиента",
            body: "Откроется досье: кто перед вами, состав и сумма долгов, и на что обратить внимание именно в этом деле.",
          },
          {
            title: "Начните чат или звонок",
            body: "Клиент отвечает в своём характере — тревожный, агрессивный, скептик — и опирается на факты своего дела. Разговор идёт как настоящий приём.",
          },
          {
            title: "Проведите консультацию",
            body: "Выясните обстоятельства (долги, доход, иждивенцы, жильё в залоге), предложите верный путь — реструктуризация, реализация имущества или внесудебное МФЦ. Без обещаний «всё спишут».",
          },
          {
            title: "Завершите и посмотрите разбор",
            body: "Когда закончите приём, откроется разбор: правовая точность по ФЗ-127, полнота выяснения обстоятельств, корректность рекомендаций и работа с сомнениями клиента.",
          },
        ]}
      >
        <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Сложность и характер клиента — фильтрами ниже. Если только осваиваетесь, начните с «Просто».
        </p>
      </OnboardingHint>

      {/* Фильтры — по сложности и характеру, со счётчиком показанных. */}
      {(personas.length > 0) && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: null as Difficulty | null, label: "Все" },
              { key: "easy" as Difficulty, label: difficultyMeta("easy").label },
              { key: "medium" as Difficulty, label: difficultyMeta("medium").label },
              { key: "hard" as Difficulty, label: difficultyMeta("hard").label },
            ].map(({ key, label }) => {
              const active = difficultyFilter === key;
              return (
                <button
                  key={label}
                  onClick={() => setDifficultyFilter(key)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? "var(--accent-muted)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
            {archetypeOptions.length > 1 && (
              <Select
                value={archetypeFilter ?? "__all__"}
                onValueChange={(v) => setArchetypeFilter(v === "__all__" ? null : v)}
              >
                <SelectTrigger className="h-auto w-auto min-w-[160px] gap-2 px-3.5 py-1.5 text-xs font-medium">
                  <SelectValue placeholder="Любой характер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Любой характер</SelectItem>
                  {archetypeOptions.map((a) => (
                    <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            {filtered.length === personas.length
              ? `${personas.length} ${plural(personas.length, "клиент", "клиента", "клиентов")}`
              : `${filtered.length} из ${personas.length}`}
          </p>
        </div>
      )}

      {loadError && (
        <EmptyState
          icon={AlertTriangle}
          title="Не удалось загрузить клиентов"
          description={loadError}
          actionLabel="Обновить"
          onAction={() => window.location.reload()}
        />
      )}

      {!loadError && filtered.length === 0 && (
        personas.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Клиенты пока не добавлены"
            description="Список появится, как только в системе будут готовые клиенты для практики."
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Нет клиентов под фильтры"
            description="Под выбранные сложность и характер никто не подошёл. Попробуйте сбросить фильтры."
            actionLabel="Сбросить фильтры"
            onAction={() => { setDifficultyFilter(null); setArchetypeFilter(null); }}
          />
        )
      )}

      {/* Editorial-грид карточек: индекс, точка-сложность, hover-стрелка, hairline + lift. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filtered.map((p, i) => {
          const dm = difficultyMeta(p.difficulty);
          const situation = shortSituation(p);
          return (
            <button
              key={p.slug}
              onClick={() => setSelectedSlug(p.slug)}
              className="group relative flex flex-col text-left rounded-2xl p-6 sm:p-7 bg-[var(--surface-card)] border border-[var(--border-color)] [box-shadow:var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:[box-shadow:var(--shadow-md)]"
            >
              {/* Верхняя строка: индекс + индикатор сложности (точка + mono-лейбл). */}
              <div className="flex items-center justify-between">
                <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: dm.tone }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: dm.tone }} aria-hidden />
                  {dm.label}
                </span>
              </div>

              {/* Имя крупно. */}
              <h3 className="mt-4 font-display text-xl font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                {p.name}
              </h3>

              {/* Мета: характер · эмоция. */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {p.archetype_label && <span>{p.archetype_label}</span>}
                {emotionLabel(p.emotion_preset) && (
                  <><span aria-hidden>·</span><span>{emotionLabel(p.emotion_preset)}</span></>
                )}
              </div>

              {/* Ситуация — одна-две строки. */}
              {situation && (
                <p className="mt-4 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                  {situation}
                </p>
              )}

              {/* Hover-аффорданс: «Открыть досье →». */}
              <span
                className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors group-hover:text-[var(--accent)]"
                style={{ color: "var(--text-muted)" }}
              >
                Открыть досье
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
