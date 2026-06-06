"use client";

/**
 * IncomingCallScreen (2026-04-23, Sprint 5 / Zone 2 of plan moonlit-baking-crane.md)
 *
 * «Входящий звонок» screen with full client context on the phone UI.
 * Replaces the old inline accept-gate in call/page.tsx (which had only
 * «Входящий звонок» + one Accept button without any client data, no
 * Decline, no loop ringback).
 *
 * Key UX goals:
 *   - User immediately sees WHO is calling (name, age, city, profession,
 *     lead source, debt amount) before accepting — sells «CRM-driven
 *     training» positioning.
 *   - Two pill buttons: Accept (primary accent) / Decline (secondary
 *     outline). Real phone-call feel.
 *   - Framer Motion animations (one soft ring pulse, text stagger) make
 *     the screen feel alive while waiting for client_card via WS.
 *   - clientCard prop is nullable — component renders minimal state and
 *     fills in details when parent gets WS session.started event.
 *
 * The component itself is presentational — all audio (loop ringback),
 * sessionStorage persist, WS gate, POST /decline are orchestrated by
 * the parent (call/page.tsx).
 *
 * 2026-06-06 (editorial restyle, malvah/abstract reference): убран
 * radial-gradient фиолетово-чёрный фон, квадратный аватар с неон-кольцами,
 * капс «▰ ВХОДЯЩИЙ ЗВОНОК ▰», textShadow-неон, gradient/glow кнопки.
 * Теперь: спокойный var(--bg-primary), круглый аватар с тонким кольцом,
 * одно мягкое токенное pulse-ring, имя обычным регистром, mono-eyebrow,
 * primary/secondary пилюли rounded-full. ВСЯ логика (accept/reject/busy,
 * accepting/declining, callbacks, exit-animation) и props сохранены.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, MapPin, Briefcase, Wallet } from "lucide-react";
import type { EmotionState } from "@/types";
import { EMOTION_MAP } from "@/types";
import type { ClientCardData } from "@/components/training/ClientCard";

const SCENE_LABEL: Record<string, string> = {
  office: "Звонит из офиса",
  street: "На улице",
  children: "Дома с семьёй",
  tv: "Дома, рядом телевизор",
  none: "Входящий звонок",
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  cold_base: "Холодная база",
  website_form: "Заявка с сайта",
  referral: "Рекомендация",
  social_media: "Соцсети",
  partner: "Партнёр",
  incoming: "Входящий",
  repeat_call: "Повторный звонок",
};

const fmt = new Intl.NumberFormat("ru-RU");

function formatDebt(amount: number | undefined): string | null {
  if (!amount || amount <= 0) return null;
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")} млн ₽`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)} тыс ₽`;
  }
  return `${fmt.format(amount)} ₽`;
}

export interface IncomingCallScreenProps {
  characterName: string;
  /** Initial emotion from WS session.started — drives avatar ring color. */
  emotion?: EmotionState;
  /** Scene id from session.custom_params.bg_noise — drives the
   *  «Звонит из офиса» hint at the top. */
  sceneId?: string | null;
  /** Full CRM card. Null until WS session.started arrives — component
   *  renders minimal state and fills on update. */
  clientCard?: ClientCardData | null;
  /** Called on Accept click. Parent runs 3-vector audio unlock, stops the
   *  loop ringback, then flips its own state (callAccepted=true). */
  onAccept: () => void;
  /** Called on Decline click. Parent POST /decline, then router.replace. */
  onDecline: () => void;
  /** True once user has clicked Accept but before routing transitions
   *  finish — disables both buttons, dims Accept to «Соединяем...». */
  accepting?: boolean;
  /** True once user has clicked Decline — disables both buttons. */
  declining?: boolean;
}

export default function IncomingCallScreen({
  characterName,
  emotion,
  sceneId,
  clientCard,
  onAccept,
  onDecline,
  accepting = false,
  declining = false,
}: IncomingCallScreenProps) {
  const sceneKey = sceneId && sceneId in SCENE_LABEL ? sceneId : "none";
  const sceneLabel = SCENE_LABEL[sceneKey];
  // emotion kept for API compatibility; visual ring no longer color-coded.
  void emotion;
  void EMOTION_MAP;

  // Derived client info. All fields can be missing if clientCard hasn't
  // arrived yet — use graceful fallbacks so the minimal render still
  // looks complete.
  const initial = useMemo(
    () => (characterName || clientCard?.full_name || "К").charAt(0).toUpperCase(),
    [characterName, clientCard],
  );
  const displayName = clientCard?.full_name || characterName || "Клиент";
  const ageCity = [
    clientCard?.age ? `${clientCard.age}` : null,
    clientCard?.city || null,
  ]
    .filter(Boolean)
    .join(", ");
  const profession = clientCard?.profession || null;
  const leadSource = clientCard?.lead_source_label
    || (clientCard?.lead_source && LEAD_SOURCE_LABELS[clientCard.lead_source])
    || null;
  const debtStr = formatDebt(clientCard?.total_debt);

  const busy = accepting || declining;

  /*
   * Phase A (2026-05-08): exit animation off `busy` сохранена — parent
   * defer'ит setCallAccepted на 220ms, экран успевает fade+shrink.
   */
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1 }}
      animate={{
        opacity: busy ? 0 : 1,
        scale: busy ? 0.96 : 1,
      }}
      transition={{ duration: busy ? 0.2 : 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* Top strip — mono-eyebrow «Входящий звонок» + scene hint */}
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex w-full items-center justify-between px-6 pt-8 md:pt-10"
      >
        <span
          className="font-mono uppercase"
          style={{
            color: "var(--text-muted)",
            fontSize: 11,
            letterSpacing: "0.16em",
          }}
        >
          Входящий звонок
        </span>
        <span
          className="font-mono uppercase"
          style={{
            color: "var(--text-muted)",
            fontSize: 11,
            letterSpacing: "0.16em",
          }}
        >
          {sceneLabel}
        </span>
      </motion.div>

      {/* Flex spacer + avatar block */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-6 md:pt-0">
        {/* Avatar — круглый, тонкое кольцо, одно мягкое токенное pulse-ring */}
        <div className="relative flex items-center justify-center">
          {/* Single soft pulse ring — токенное, без glow */}
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            animate={{
              scale: [1, 1.14, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 200,
              height: 200,
              border: "1px solid var(--accent-muted)",
            }}
          />
          {/* Avatar circle с инициалом */}
          <div
            className="flex items-center justify-center rounded-full font-display"
            style={{
              width: 200,
              height: 200,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              boxShadow: "inset 0 0 0 4px var(--bg-primary)",
              color: "var(--text-secondary)",
              fontSize: 84,
              lineHeight: 1,
            }}
            aria-hidden
          >
            {initial}
          </div>
        </div>

        {/* Name — обычный регистр, крупно, без textShadow */}
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="mt-8 text-center font-display"
          style={{
            fontSize: "clamp(28px, 5vw, 38px)",
            color: "var(--text-primary)",
            lineHeight: 1.1,
          }}
        >
          {displayName}
        </motion.h1>

        {/* Age + city — мелко, var(--text-muted) */}
        {ageCity && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.33, duration: 0.35 }}
            className="mt-3 flex items-center gap-1.5"
            style={{ color: "var(--text-muted)", fontSize: 14 }}
          >
            <MapPin size={14} aria-hidden />
            <span>{ageCity}</span>
          </motion.div>
        )}

        {/* Profession — мелко, var(--text-muted) */}
        {profession && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.41, duration: 0.35 }}
            className="mt-1.5 flex items-center gap-1.5"
            style={{ color: "var(--text-muted)", fontSize: 14 }}
          >
            <Briefcase size={14} aria-hidden />
            <span>{profession}</span>
          </motion.div>
        )}

        {/* Lead-source + debt — чистые пилюли rounded-full, токенные */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.49, duration: 0.35 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-2"
        >
          {leadSource && (
            <span
              className="inline-flex items-center rounded-full px-3 py-1"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-color)",
                fontSize: 13,
              }}
            >
              {leadSource}
            </span>
          )}
          {debtStr && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{
                background: "var(--warning-muted)",
                color: "var(--warning)",
                border: "1px solid var(--warning)",
                fontSize: 13,
              }}
            >
              <Wallet size={13} aria-hidden />
              Долг: {debtStr}
            </span>
          )}
        </motion.div>

        {/* Subtle scene hint when clientCard is still null */}
        {!clientCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4"
            style={{ color: "var(--text-muted)", fontSize: 13 }}
          >
            Подключаем детали клиента…
          </motion.div>
        )}
      </div>

      {/* Action row — Decline (secondary) + Accept (primary), пилюли */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="w-full pb-10 md:pb-14"
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 sm:flex-row sm:justify-center">
          {/* Accept — primary пилюля rounded-full, var(--accent) */}
          <button
            type="button"
            onClick={busy ? undefined : onAccept}
            disabled={busy}
            aria-label="Принять звонок"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition disabled:cursor-wait sm:w-auto"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast, #fff)",
              border: "1px solid var(--accent)",
              boxShadow: "var(--shadow-sm)",
              opacity: busy && !accepting ? 0.6 : 1,
            }}
          >
            {accepting ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                className="inline-block rounded-full"
                style={{
                  width: 18,
                  height: 18,
                  border: "2px solid var(--accent-contrast, #fff)",
                  borderTopColor: "transparent",
                }}
                aria-hidden
              />
            ) : (
              <Phone size={18} aria-hidden />
            )}
            <span style={{ fontSize: 15 }}>
              {accepting ? "Соединяем…" : "Принять звонок"}
            </span>
          </button>

          {/* Decline — secondary пилюля rounded-full, outline */}
          <button
            type="button"
            onClick={busy ? undefined : onDecline}
            disabled={busy}
            aria-label="Отклонить звонок"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition disabled:cursor-wait sm:w-auto"
            style={{
              background: declining ? "var(--danger-muted)" : "transparent",
              color: declining ? "var(--danger)" : "var(--text-muted)",
              border: `1px solid ${declining ? "var(--danger)" : "var(--border-color)"}`,
              opacity: busy && !declining ? 0.6 : 1,
            }}
          >
            <PhoneOff size={18} aria-hidden />
            <span style={{ fontSize: 15 }}>
              {declining ? "Отменяем…" : "Отклонить"}
            </span>
          </button>
        </div>

        <div
          className="mx-auto mt-5 max-w-md px-6 text-center"
          style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}
        >
          Нажмите «Принять» чтобы подключить звук —<br />
          браузер требует жест пользователя
        </div>
      </motion.div>
    </motion.div>
  );
}
