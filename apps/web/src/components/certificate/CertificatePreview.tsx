"use client";

/**
 * CertificatePreview — the product's trophy: «Сертификат аттестации».
 *
 * Editorial navy + gold diploma (landscape), matching the brand reference
 * (СРО · АСПБ · ТЕХНОЛОГИИ ПРАВА). Two variants:
 *   - "earned": the awarded certificate with real name/score/date/code.
 *   - "locked": the same face blurred behind an invitational lock + CTA
 *               (marketing teaser — "almost yours", never "denied").
 *
 * Design grounding (malvah.co + abstract.com): hierarchy by scale, serif
 * display + letter-spaced caps, ONE accent (gold), hairline-only rules,
 * generous whitespace, restrained dark palette.
 *
 * The diploma owns a FIXED navy+gold identity (not theme-driven). The
 * `palette` prop is retained for API compatibility but no longer drives the
 * face colours.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";

export interface CertPalette {
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  hairline: string;
  accent: string;
  shadowMd: string;
}

/** Retained for callers; the cert face uses its own fixed navy+gold identity. */
export const CERT_LIGHT_PALETTE: CertPalette = {
  bg: "#F7F1E8",
  surface: "#FFFDF8",
  textPrimary: "#18131D",
  textSecondary: "#5F5367",
  textMuted: "#9B7DB4",
  hairline: "#D9C9E8",
  accent: "#7C3AED",
  shadowMd: "0 24px 60px -28px rgba(24,19,29,0.28)",
};

export const CERT_TOKEN_PALETTE: CertPalette = {
  bg: "var(--bg-secondary)",
  surface: "var(--surface-card)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  hairline: "var(--border-color)",
  accent: "var(--primary)",
  shadowMd: "var(--shadow-md)",
};

/* Fixed diploma identity (navy + gold) — matches the brand reference. */
const NAVY = "#0e1a2e";
const NAVY_DEEP = "#0a1422";
const GOLD = "#cda96a";
const GOLD_SOFT = "#d8bd84";
const CREAM = "#efe9dc";
const MUTED = "#8b97ab";
const HAIR = "rgba(205,169,106,0.34)";

const SERIF = 'Georgia, "Times New Roman", serif';

interface CertificatePreviewProps {
  variant: "locked" | "earned";
  palette?: CertPalette;
  recipientName?: string;
  issueDate?: string;
  verificationCode?: string;
  score?: string;
  award?: string;
  lockTitle?: string;
  lockSubtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

const DEFAULT_CODE = "АУ-2026-0001";
const DEFAULT_DATE = "29.05.2026";
const DEFAULT_SCORE = "94 балла";

/* ── The diploma face (navy + gold, landscape) ───────────────────────────── */

function CertificateFace({
  recipientName,
  issueDate,
  verificationCode,
  score,
}: {
  recipientName?: string;
  issueDate: string;
  verificationCode: string;
  score: string;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
        padding: "clamp(16px, 4%, 34px)",
        color: CREAM,
      }}
    >
      {/* gold double-rule frame */}
      <div aria-hidden className="pointer-events-none absolute" style={{ inset: 10, border: `1px solid ${GOLD}`, opacity: 0.55 }} />
      <div aria-hidden className="pointer-events-none absolute" style={{ inset: 14, border: `1px solid ${HAIR}` }} />

      <div className="relative flex h-full flex-col" style={{ padding: "clamp(10px, 3%, 26px)" }}>
        {/* top row */}
        <div className="flex items-center justify-between font-mono uppercase" style={{ fontSize: 8.5, letterSpacing: "0.22em", color: MUTED }}>
          <span>СРО «Дело» · АСПБ</span>
          <span className="hidden sm:inline">Attestation · Édition 01 · MMXXVI</span>
          <span style={{ color: GOLD }}>Технологии права</span>
        </div>

        {/* certificate number */}
        <div className="font-mono uppercase" style={{ marginTop: "clamp(14px,4%,28px)", fontSize: 9.5, letterSpacing: "0.18em", color: GOLD }}>
          — Сертификат № {verificationCode}
        </div>

        {/* serif display title */}
        <h3 style={{ marginTop: 6, fontFamily: SERIF, fontSize: "clamp(26px, 7vw, 52px)", lineHeight: 1.0, fontWeight: 700, color: CREAM }}>
          Сертификат <em style={{ color: GOLD_SOFT, fontStyle: "italic" }}>аттестации</em>
        </h3>
        <div className="uppercase" style={{ marginTop: 6, fontSize: 9, letterSpacing: "0.5em", color: MUTED }}>
          A · Legal · Atelier
        </div>

        {/* recipient */}
        <div style={{ marginTop: "clamp(14px,4%,30px)", fontSize: 12, color: MUTED }}>Настоящим удостоверяется, что</div>
        <div
          style={{
            marginTop: 6,
            fontFamily: SERIF,
            fontSize: "clamp(20px,5vw,34px)",
            fontWeight: 700,
            color: GOLD_SOFT,
            borderBottom: recipientName ? `1px solid ${HAIR}` : "none",
            paddingBottom: 4,
            display: "inline-block",
          }}
        >
          {recipientName ?? "Фамилия Имя Отчество"}
        </div>

        <p style={{ marginTop: "clamp(10px,2.5%,18px)", maxWidth: 640, fontSize: 12, lineHeight: 1.5, color: "#c5cdd9" }}>
          успешно прошёл(-ла) аттестацию по программе «Банкротство физических лиц» — 250 вопросов по ФЗ-127
          и актуальной судебной практике — и подтвердил(-а) квалификацию специалиста по сопровождению процедур банкротства.
        </p>

        {/* three gold stats */}
        <div className="flex flex-wrap" style={{ marginTop: "clamp(14px,4%,26px)", gap: "clamp(20px,5%,52px)" }}>
          {[
            { v: "250", l: "вопросов · ФЗ-127" },
            { v: score, l: "итоговый результат" },
            { v: issueDate, l: "дата выдачи" },
          ].map((s) => (
            <div key={s.l}>
              <div style={{ fontFamily: SERIF, fontSize: "clamp(18px,4vw,30px)", fontWeight: 700, color: GOLD }}>{s.v}</div>
              <div className="uppercase" style={{ marginTop: 2, fontSize: 8, letterSpacing: "0.14em", color: MUTED }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className="flex-1" style={{ minHeight: 12 }} />

        {/* footer: emitter / partner / seal */}
        <div className="flex items-end justify-between gap-3" style={{ borderTop: `1px solid ${HAIR}`, paddingTop: "clamp(10px,2.5%,16px)" }}>
          <div className="hidden sm:block">
            <div className="uppercase" style={{ fontSize: 7.5, letterSpacing: "0.14em", color: MUTED }}>Эмитент · саморегулируемая организация</div>
            <div style={{ marginTop: 3, fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: CREAM }}>СРО «Дело»</div>
            <div style={{ fontSize: 8.5, color: MUTED }}>Первая школа банкротства</div>
          </div>
          <div className="hidden sm:block">
            <div className="uppercase" style={{ fontSize: 7.5, letterSpacing: "0.14em", color: MUTED }}>Партнёр · агентство сопровождения</div>
            <div style={{ marginTop: 3, fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: CREAM }}>АСПБ</div>
            <div style={{ fontSize: 8.5, color: MUTED }}>Сопровождение процедур банкротства</div>
          </div>
          {/* gold pixel seal */}
          <div className="flex flex-col items-center" style={{ gap: 4 }}>
            <div
              aria-hidden
              style={{
                width: 44, height: 44, padding: 5,
                border: `1px solid ${GOLD}`,
                display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 1.5,
              }}
            >
              {Array.from({ length: 25 }).map((_, i) => (
                <span key={i} style={{ background: (i * 7 + 3) % 3 === 0 ? GOLD : "transparent" }} />
              ))}
            </div>
            <span className="uppercase" style={{ fontSize: 6.5, letterSpacing: "0.1em", color: MUTED }}>верификация онлайн</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The component ────────────────────────────────────────────────────────── */

export function CertificatePreview({
  variant,
  recipientName,
  issueDate = DEFAULT_DATE,
  verificationCode = DEFAULT_CODE,
  score = DEFAULT_SCORE,
  lockTitle = "Пройдите курс — и получите сертификат.",
  lockSubtitle,
  ctaLabel = "Начать обучение",
  onCta,
  className,
}: CertificatePreviewProps) {
  const reduce = useReducedMotion();
  const locked = variant === "locked";

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ width: "100%", maxWidth: 760, marginInline: "auto" }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "1.414 / 1",
          borderRadius: 10,
          border: `1px solid ${HAIR}`,
          boxShadow: "0 30px 70px -30px rgba(8,16,30,0.6)",
          background: NAVY_DEEP,
        }}
      >
        {/* face (blurred when locked) */}
        <div
          aria-hidden={locked}
          style={
            locked
              ? { position: "absolute", inset: 0, filter: "blur(5px)", opacity: 0.6, transform: "scale(1.02)" }
              : { position: "absolute", inset: 0 }
          }
        >
          <CertificateFace
            recipientName={recipientName}
            issueDate={issueDate}
            verificationCode={verificationCode}
            score={score}
          />
        </div>

        {/* locked overlay */}
        {locked && (
          <>
            <div aria-hidden className="absolute inset-0" style={{ background: NAVY_DEEP, opacity: 0.62 }} />
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ padding: "clamp(20px,7%,40px)" }}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: 60, height: 60, border: `1px solid ${GOLD}`, background: "rgba(205,169,106,0.08)" }}
              >
                <Lock size={26} strokeWidth={1.5} style={{ color: GOLD }} />
              </span>
              <h4 style={{ marginTop: 18, maxWidth: 320, fontFamily: SERIF, fontSize: "clamp(18px,4vw,24px)", lineHeight: 1.25, fontWeight: 700, color: CREAM }}>
                {lockTitle}
              </h4>
              {lockSubtitle && (
                <p style={{ marginTop: 10, maxWidth: 320, fontSize: 13, lineHeight: 1.45, color: "#c5cdd9" }}>{lockSubtitle}</p>
              )}
              {onCta && (
                <motion.button
                  onClick={onCta}
                  className="mt-6 inline-flex items-center gap-2"
                  style={{ background: GOLD, color: NAVY_DEEP, fontSize: 15, fontWeight: 700, padding: "12px 26px", borderRadius: 10 }}
                  whileHover={reduce ? undefined : { scale: 1.02 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                >
                  {ctaLabel}
                  <ArrowRight size={16} />
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
