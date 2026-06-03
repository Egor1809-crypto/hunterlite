"use client";

/**
 * CertificatePreview — the product's trophy: «Сертификат аттестации».
 *
 * Light editorial diploma (landscape) in the platform's own aesthetic
 * (malvah.co + abstract.com): cream/white surface, ONE accent (purple),
 * hairline-only rules, hierarchy by scale, generous whitespace, letter-spaced
 * caps. Two variants:
 *   - "earned": awarded certificate with real name/score/date/code.
 *   - "locked": same face blurred behind an invitational lock + CTA.
 *
 * Palette-driven, so it works on the cream marketing landing AND inside the
 * token-themed app (light + dark) via the exported palettes.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";

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

/** Fixed light palette for the marketing landing (matches its print-like hex). */
export const CERT_LIGHT_PALETTE: CertPalette = {
  bg: "#F7F1E8",
  surface: "#FFFDF8",
  textPrimary: "#18131D",
  textSecondary: "#5F5367",
  textMuted: "#9B7DB4",
  hairline: "#D9C9E8",
  accent: "#7C3AED",
  shadowMd: "0 30px 70px -34px rgba(24,19,29,0.30)",
};

/** Token palette for in-app usage (resolves correctly in light AND dark). */
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

/* ── The diploma face (light editorial, landscape) ───────────────────────── */

function CertificateFace({
  p,
  recipientName,
  issueDate,
  verificationCode,
  score,
}: {
  p: CertPalette;
  recipientName?: string;
  issueDate: string;
  verificationCode: string;
  score: string;
}) {
  const cap = (extra?: React.CSSProperties): React.CSSProperties => ({
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontSize: 8.5,
    color: p.textMuted,
    ...extra,
  });
  return (
    <div
      className="relative flex h-full w-full flex-col"
      style={{ background: p.surface, padding: "clamp(16px, 4%, 34px)", color: p.textPrimary }}
    >
      {/* single hairline frame — restrained, abstract.com */}
      <div aria-hidden className="pointer-events-none absolute" style={{ inset: 12, border: `1px solid ${p.hairline}` }} />

      <div className="relative flex h-full flex-col" style={{ padding: "clamp(10px, 3%, 26px)" }}>
        {/* top row */}
        <div className="flex items-center justify-between">
          <span style={cap()}>LegalHunter · ФЗ-127</span>
          <span className="hidden sm:inline" style={cap()}>Аттестация · 2026</span>
          <span style={cap({ color: p.accent })}>ТехнологИИ Права</span>
        </div>

        {/* certificate number */}
        <div style={{ marginTop: "clamp(14px,4%,30px)", ...cap({ letterSpacing: "0.2em" }) }}>
          Сертификат № {verificationCode}
        </div>

        {/* display title — hierarchy by scale, one accent word */}
        <h3 style={{ marginTop: 8, fontSize: "clamp(26px, 7vw, 56px)", lineHeight: 0.95, fontWeight: 600, letterSpacing: "-0.05em", color: p.textPrimary }}>
          Сертификат <span style={{ color: p.accent }}>аттестации</span>
        </h3>

        {/* recipient */}
        <div style={{ marginTop: "clamp(16px,4%,32px)", fontSize: 12.5, color: p.textSecondary }}>Настоящим удостоверяется, что</div>
        <div
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            fontSize: "clamp(20px,5vw,34px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: recipientName ? p.textPrimary : p.textMuted,
            borderBottom: `1px solid ${p.hairline}`,
            paddingBottom: 4,
          }}
        >
          {recipientName ?? "Фамилия Имя Отчество"}
        </div>

        <p style={{ marginTop: "clamp(12px,3%,20px)", maxWidth: 660, fontSize: 12.5, lineHeight: 1.5, color: p.textSecondary }}>
          успешно прошёл(-ла) аттестацию по программе «Банкротство физических лиц» — 250 вопросов по ФЗ-127
          и актуальной судебной практике — и подтвердил(-а) квалификацию специалиста по сопровождению процедур банкротства.
        </p>

        {/* three stats — accent numbers */}
        <div className="flex flex-wrap" style={{ marginTop: "clamp(16px,4%,28px)", gap: "clamp(22px,5%,56px)" }}>
          {[
            { v: "250", l: "вопросов · ФЗ-127" },
            { v: score, l: "итоговый результат" },
            { v: issueDate, l: "дата выдачи" },
          ].map((s) => (
            <div key={s.l}>
              <div style={{ fontSize: "clamp(18px,4vw,30px)", fontWeight: 600, letterSpacing: "-0.04em", color: p.accent }}>{s.v}</div>
              <div style={{ marginTop: 3, ...cap({ fontSize: 8 }) }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className="flex-1" style={{ minHeight: 12 }} />

        {/* footer */}
        <div className="flex items-end justify-between gap-3" style={{ borderTop: `1px solid ${p.hairline}`, paddingTop: "clamp(10px,2.5%,16px)" }}>
          <div className="hidden sm:block">
            <span style={cap({ fontSize: 7.5 })}>Эмитент · комиссия</span>
            <div style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: p.textPrimary }}>LegalHunter</div>
            <div style={{ fontSize: 8.5, color: p.textMuted }}>Заверено практикующими юристами РФ</div>
          </div>
          <div className="hidden flex-col items-center sm:flex">
            <span style={{ width: 120, height: 1, background: p.hairline }} />
            <span style={{ marginTop: 5, ...cap({ fontSize: 7.5 }) }}>Подпись комиссии</span>
          </div>
          <div className="flex flex-col items-center" style={{ gap: 4 }}>
            <span className="flex items-center justify-center rounded-full" style={{ width: 42, height: 42, border: `1px solid ${p.accent}` }}>
              <ShieldCheck size={18} strokeWidth={1.5} style={{ color: p.accent }} />
            </span>
            <span style={cap({ fontSize: 6.5 })}>верификация онлайн</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The component ────────────────────────────────────────────────────────── */

export function CertificatePreview({
  variant,
  palette = CERT_LIGHT_PALETTE,
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
  const p = palette;

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
          border: `1px solid ${p.hairline}`,
          boxShadow: p.shadowMd,
          background: p.surface,
        }}
      >
        {/* face (blurred when locked) */}
        <div
          aria-hidden={locked}
          style={
            locked
              ? { position: "absolute", inset: 0, filter: "blur(5px)", opacity: 0.55, transform: "scale(1.02)" }
              : { position: "absolute", inset: 0 }
          }
        >
          <CertificateFace p={p} recipientName={recipientName} issueDate={issueDate} verificationCode={verificationCode} score={score} />
        </div>

        {/* locked overlay */}
        {locked && (
          <>
            <div aria-hidden className="absolute inset-0" style={{ background: p.surface, opacity: 0.7 }} />
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ padding: "clamp(20px,7%,40px)" }}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: 60, height: 60, border: `1px solid ${p.hairline}`, background: p.surface }}
              >
                <Lock size={26} strokeWidth={1.5} style={{ color: p.accent }} />
              </span>
              <h4 style={{ marginTop: 18, maxWidth: 340, fontSize: "clamp(18px,4vw,24px)", lineHeight: 1.25, fontWeight: 600, letterSpacing: "-0.02em", color: p.textPrimary }}>
                {lockTitle}
              </h4>
              {lockSubtitle && (
                <p style={{ marginTop: 10, maxWidth: 340, fontSize: 13, lineHeight: 1.45, color: p.textSecondary }}>{lockSubtitle}</p>
              )}
              {onCta && (
                <motion.button
                  onClick={onCta}
                  className="mt-6 inline-flex items-center gap-2"
                  style={{ background: p.textPrimary, color: p.surface, fontSize: 15, fontWeight: 600, padding: "12px 26px", borderRadius: 999 }}
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
