"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

import { useNotificationStore } from "@/stores/useNotificationStore";
import { Loader2, Lock, MessageCircle, Phone, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
  const [starting, setStarting] = useState(false);

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
    setStarting(true);
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
        setStarting(false);
        return;
      }
      useNotificationStore.getState().addToast({
        title: "Ошибка",
        body: err instanceof Error ? err.message : "Не удалось создать сессию",
        type: "error",
      });
      setStarting(false);
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
      <div className="mx-auto max-w-md text-center py-16 px-4">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--primary-muted)", border: "1px solid var(--border-color)" }}>
          <Lock size={26} style={{ color: "var(--brand-logo-hunter)" }} />
        </div>
        <h2 className="font-display text-xl font-bold" style={{ color: "var(--text-primary)" }}>Практика пока закрыта</h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {unlockHint || "Пройдите регион «Условия подачи» (10 уровней теста), чтобы открыть практику с клиентом."}
        </p>
        <div className="mt-6">
          <Button variant="primary" size="sm" onClick={() => { if (onGoToTests) onGoToTests(); else router.push("/training?tab=tests"); }}>
            Перейти к тестам
          </Button>
        </div>
      </div>
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
          className="mb-8 inline-flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={16} />
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
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: dm.bg, color: dm.tone }}
            >
              {dm.label}
            </span>
          </div>

          {/* Кто / ситуация */}
          {selected.client_brief && (
            <div className="mt-8">
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                Кто перед вами
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                {selected.client_brief}
              </p>
            </div>
          )}

          {/* На что обратить внимание (тренировочная подсказка юристу) */}
          {selected.lawyer_brief && (
            <div
              className="mt-6 rounded-xl p-5"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-color)" }}
            >
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                На что обратить внимание
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                {selected.lawyer_brief}
              </p>
            </div>
          )}

          {/* Действия */}
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={() => handleStart("chat")}
              disabled={starting}
              loading={starting}
              icon={<MessageCircle size={16} />}
            >
              Чат
            </Button>
            <Button
              onClick={() => handleStart("call")}
              disabled={starting}
              loading={starting}
              icon={<Phone size={16} />}
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-muted)" }}
            >
              Звонок
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: gallery grid ───
  return (
    <div className="mt-8">
      {/* Заголовок-интро: whitespace-first, сдержанная типографика. */}
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Мои клиенты
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Выберите клиента, чтобы начать чат или звонок.
        </p>
      </div>

      {/* Опциональные фильтры — по сложности и архетипу. */}
      {(personas.length > 0) && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDifficultyFilter(null)}
            className="rounded-full px-3 py-1 text-xs transition-colors"
            style={{
              background: !difficultyFilter ? "var(--accent-muted)" : "transparent",
              color: !difficultyFilter ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${!difficultyFilter ? "var(--accent)" : "var(--border-color)"}`,
            }}
          >
            Все
          </button>
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
            const m = difficultyMeta(d);
            const active = difficultyFilter === d;
            return (
              <button
                key={d}
                onClick={() => setDifficultyFilter(active ? null : d)}
                className="rounded-full px-3 py-1 text-xs transition-colors"
                style={{
                  background: active ? m.bg : "transparent",
                  color: active ? m.tone : "var(--text-muted)",
                  border: `1px solid ${active ? m.tone : "var(--border-color)"}`,
                }}
              >
                {m.label}
              </button>
            );
          })}
          {archetypeOptions.length > 1 && (
            <select
              value={archetypeFilter ?? ""}
              onChange={(e) => setArchetypeFilter(e.target.value || null)}
              className="rounded-full px-3 py-1 text-xs outline-none"
              style={{
                background: "transparent",
                color: archetypeFilter ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${archetypeFilter ? "var(--accent)" : "var(--border-color)"}`,
              }}
            >
              <option value="">Любой характер</option>
              {archetypeOptions.map((a) => (
                <option key={a.code} value={a.code}>{a.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}>
          {loadError}
        </div>
      )}

      {!loadError && filtered.length === 0 && (
        <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          {personas.length === 0 ? "Клиенты пока не добавлены." : "Нет клиентов под выбранные фильтры."}
        </div>
      )}

      {/* Редакторский грид карточек. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const dm = difficultyMeta(p.difficulty);
          const situation = shortSituation(p);
          return (
            <button
              key={p.slug}
              onClick={() => setSelectedSlug(p.slug)}
              className="group text-left rounded-2xl p-6 transition-all"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Крупное имя */}
                <h3 className="font-display text-lg font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                  {p.name}
                </h3>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: dm.bg, color: dm.tone }}
                >
                  {dm.label}
                </span>
              </div>

              {/* Мелкая мьютед мета: архетип + эмоция */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {p.archetype_label && <span>{p.archetype_label}</span>}
                {emotionLabel(p.emotion_preset) && (
                  <><span aria-hidden>·</span><span>{emotionLabel(p.emotion_preset)}</span></>
                )}
              </div>

              {/* Одна строка ситуации */}
              {situation && (
                <p className="mt-4 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                  {situation}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
