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

/**
 * Fully-purple monochrome diploma — one colour family only. Used EVERYWHERE
 * (landing + platform, light + dark) so the certificate reads as a single fixed
 * brand asset, not a theme-adaptive card. Both exported names resolve to it so
 * existing call sites need no change.
 */
const CERT_PURPLE_PALETTE: CertPalette = {
  bg: "#5E4D92",
  surface: "#6E5AA8",       // milky muted violet diploma face
  textPrimary: "#FFFFFF",   // bright white
  textSecondary: "#F0EBFC", // bright light
  textMuted: "#DCD3F2",     // bright, for the tiny uppercase eyebrows
  hairline: "rgba(255,255,255,0.32)",
  accent: "#FFFFFF",        // all marks white — «белые надписи»
  shadowMd: "0 30px 70px -30px rgba(40,26,80,0.45)",
};

export const CERT_LIGHT_PALETTE: CertPalette = CERT_PURPLE_PALETTE;
export const CERT_TOKEN_PALETTE: CertPalette = CERT_PURPLE_PALETTE;

interface CertificatePreviewProps {
  variant: "locked" | "earned";
  palette?: CertPalette;
  recipientName?: string;
  issueDate?: string;
  verificationCode?: string;
  program?: string;
  format?: string;
  /** Overrides the body paragraph; defaults to a sentence built from `program`. */
  programDescription?: string;
  /** Issuer name under the signature line. Defaults to "LegalHunter". */
  issuerName?: string;
  score?: string;
  award?: string;
  lockTitle?: string;
  lockSubtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
  /**
   * When true, the diploma face renders WITHOUT blur even in variant="locked"
   * (full clarity). Defaults to false — the historical blurred behaviour.
   */
  revealed?: boolean;
  /**
   * When false, no lock overlay is drawn at all (no lock icon, no
   * lockTitle/lockSubtitle, no CTA) — only the clean diploma. Defaults to true.
   * Combine `revealed showOverlayText={false}` for a clean, fully visible
   * certificate with no dimming and no text on top.
   */
  showOverlayText?: boolean;
}

const DEFAULT_CODE = "LH-BFL-2026-001";
const DEFAULT_DATE = "29.05.2026";
const DEFAULT_PROGRAM = "Банкротство физических лиц";
const DEFAULT_FORMAT = "Онлайн-курс";

/* ── The diploma face (light editorial, landscape) ───────────────────────── */

function CertificateFace({
  p,
  recipientName,
  issueDate,
  verificationCode,
  program,
  format,
  programDescription,
  issuerName = "LegalHunter",
}: {
  p: CertPalette;
  recipientName?: string;
  issueDate: string;
  verificationCode: string;
  program: string;
  format: string;
  programDescription?: string;
  issuerName?: string;
}) {
  // Shared letter-spaced uppercase voice of the diploma — tiny mono eyebrows.
  const cap = (extra?: React.CSSProperties): React.CSSProperties => ({
    textTransform: "uppercase",
    letterSpacing: "0.22em",
    fontSize: "clamp(6.5px, 0.95vw, 9px)",
    fontWeight: 600,
    lineHeight: 1,
    color: p.textMuted,
    ...extra,
  });

  const meta = [
    { label: "Программа", value: program },
    { label: "Формат", value: format },
    { label: "Дата выдачи", value: issueDate },
  ];

  const body =
    programDescription ??
    (recipientName
      ? `успешно прошёл курс по программе «${program}» и подтвердил освоение ключевых практических аспектов сопровождения процедур банкротства граждан.`
      : `Документ удостоверяет освоение программы и ключевых практических аспектов сопровождения процедур банкротства граждан.`);

  return (
    <div
      className="relative flex h-full w-full"
      style={{ background: p.surface, color: p.textPrimary, padding: "clamp(9px, 2.2%, 20px)" }}
    >
      {/* Engraved hairline frame */}
      <div
        className="relative flex h-full w-full flex-col"
        style={{ border: `1px solid ${p.hairline}`, borderRadius: 3, padding: "clamp(16px, 4.4%, 42px)" }}
      >
        {/* TOP ROW — wordmark · centred discipline · sub-brand */}
        <div className="relative flex items-center justify-between gap-3">
          <span style={{ fontSize: "clamp(11px, 1.6vw, 15px)", fontWeight: 800, letterSpacing: "0.02em", color: p.textPrimary }}>
            LEGAL<span style={{ color: p.accent }}>HUNTER</span>
          </span>
          <span className="hidden items-center gap-2 sm:flex" style={cap()}>
            <span style={{ width: 16, height: 1, background: p.hairline }} />
            Свидетельство об аттестации
            <span style={{ width: 16, height: 1, background: p.hairline }} />
          </span>
          <span style={cap({ color: p.accent })}>ТехнологИИ&nbsp;Права</span>
        </div>

        <span style={{ marginTop: "clamp(8px, 2%, 16px)", display: "block", height: 1, background: p.hairline }} />

        {/* TITLE BLOCK — eyebrow code over a huge display title */}
        <div className="relative" style={{ marginTop: "clamp(12px, 3.2%, 30px)" }}>
          <div className="flex items-baseline gap-3">
            <span style={cap({ color: p.textSecondary, letterSpacing: "0.3em" })}>Сертификат&nbsp;аттестации</span>
            <span style={cap({ fontVariantNumeric: "tabular-nums", letterSpacing: "0.14em" })}>RU&middot;ATT</span>
          </div>
          <h3 style={{ marginTop: "clamp(4px, 1%, 10px)", fontSize: "clamp(34px, 9vw, 76px)", lineHeight: 0.88, fontWeight: 600, letterSpacing: "-0.05em", color: p.textPrimary }}>
            Сертифи<span style={{ color: p.accent }}>кат</span>
          </h3>
        </div>

        {/* RECIPIENT — name when issued; on the public specimen (no name) the
            programme becomes the hero so there is no «Имя Фамилия» placeholder
            and no empty gap. */}
        <div style={{ marginTop: "clamp(16px, 3.6%, 30px)", ...cap({ color: p.textSecondary, letterSpacing: "0.2em" }) }}>
          {recipientName ? "Настоящим подтверждается, что" : "Настоящим удостоверяется освоение программы"}
        </div>
        <div className="relative" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
          <div
            style={{
              marginTop: "clamp(6px, 1.6%, 13px)",
              fontSize: "clamp(24px, 6vw, 46px)",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.0,
              color: p.textPrimary,
            }}
          >
            {recipientName ?? `«${program}»`}
          </div>
          <span
            style={{
              marginTop: "clamp(6px, 1.4%, 11px)",
              display: "block",
              height: 1,
              background: p.accent,
            }}
          />
        </div>

        {/* BODY */}
        <p style={{ marginTop: "clamp(11px, 2.8%, 22px)", maxWidth: 580, fontSize: "clamp(10px, 1.5vw, 13px)", lineHeight: 1.6, color: p.textSecondary }}>
          {body}
        </p>

        <div className="flex-1" style={{ minHeight: 10 }} />

        {/* META — three columns divided by air + hairline ticks (no boxes) */}
        <div
          className="relative grid grid-cols-3"
          style={{ marginTop: "clamp(10px, 2.4%, 18px)", borderTop: `1px solid ${p.hairline}` }}
        >
          {meta.map(({ label, value }, i) => (
            <div
              key={label}
              style={{
                position: "relative",
                padding: "clamp(9px, 1.9%, 15px) clamp(2px, 1.2%, 14px) 0",
                borderLeft: i === 0 ? "none" : `1px solid ${p.hairline}`,
              }}
            >
              {/* registration tick at top of each column */}
              <span aria-hidden style={{ position: "absolute", top: -1, left: i === 0 ? 0 : -1, width: 1, height: 6, background: p.accent }} />
              <div className="flex items-center gap-1.5" style={cap({ fontSize: "clamp(6px, 0.85vw, 7.5px)" })}>
                <span style={{ fontVariantNumeric: "tabular-nums", color: p.accent }}>{`0${i + 1}`}</span>
                {label}
              </div>
              <div className="truncate" style={{ marginTop: 5, fontSize: "clamp(9px, 1.4vw, 12.5px)", fontWeight: 600, letterSpacing: "-0.01em", color: p.textPrimary }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER — cert № · signature · engraved seal */}
        <div className="flex items-end justify-between gap-3" style={{ marginTop: "clamp(12px, 3%, 24px)" }}>
          <div>
            <span style={cap({ fontSize: "clamp(6px, 0.85vw, 7px)" })}>Сертификат №</span>
            <div
              style={{
                marginTop: 6,
                fontSize: "clamp(9px, 1.3vw, 12px)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                fontVariantNumeric: "tabular-nums",
                color: p.textPrimary,
              }}
            >
              {verificationCode}
            </div>
          </div>

          <div className="hidden flex-col items-center sm:flex">
            <span style={{ marginBottom: 7, fontSize: "clamp(11px, 1.6vw, 15px)", fontWeight: 700, letterSpacing: "-0.01em", color: p.textPrimary, fontStyle: "italic" }}>
              {issuerName}
            </span>
            <span style={{ width: "clamp(110px, 17vw, 168px)", height: 1, background: p.hairline }} />
            <span style={{ marginTop: 7, ...cap({ fontSize: "clamp(6px, 0.85vw, 7px)" }) }}>Подпись комиссии</span>
          </div>

          {/* Engraved verification seal — double hairline rings + curved legend */}
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <span
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: "clamp(46px, 8.4vw, 64px)",
                height: "clamp(46px, 8.4vw, 64px)",
                border: `1px solid ${p.hairline}`,
              }}
            >
              <ShieldCheck size={20} strokeWidth={1.25} style={{ color: p.accent, width: "40%", height: "40%" }} />
            </span>
            <span style={cap({ fontSize: "clamp(5.5px, 0.8vw, 7px)", color: p.accent, letterSpacing: "0.26em" })}>Проверено</span>
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
  program = DEFAULT_PROGRAM,
  format = DEFAULT_FORMAT,
  programDescription,
  issuerName = "LegalHunter",
  lockTitle = "Пройдите курс — и получите сертификат.",
  lockSubtitle,
  ctaLabel = "Начать обучение",
  onCta,
  className,
  revealed = false,
  showOverlayText = true,
}: CertificatePreviewProps) {
  const reduce = useReducedMotion();
  const locked = variant === "locked";
  const p = palette;

  // The face is blurred only when locked AND not explicitly revealed.
  const blurred = locked && !revealed;
  // The invitational lock overlay is drawn only when locked AND overlay text
  // is allowed (clean-reveal callers pass showOverlayText={false}).
  const showOverlay = locked && showOverlayText;

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ width: "100%", maxWidth: 920, marginInline: "auto" }}
    >
      <div className="relative">
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
        {/* face (blurred only when locked and not revealed) */}
        <div
          aria-hidden={showOverlay}
          style={
            blurred
              ? { position: "absolute", inset: 0, filter: "blur(5px)", opacity: 0.55, transform: "scale(1.02)" }
              : { position: "absolute", inset: 0 }
          }
        >
          <CertificateFace p={p} recipientName={recipientName} issueDate={issueDate} verificationCode={verificationCode} program={program} format={format} programDescription={programDescription} issuerName={issuerName} />
        </div>

        {/* locked overlay */}
        {showOverlay && (
          <>
            <div aria-hidden className="absolute inset-0" style={{ background: p.surface, opacity: 0.78 }} />
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ padding: "clamp(20px,7%,44px)" }}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            >
              <span
                className="inline-flex items-center gap-2"
                style={{ textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "clamp(7px,1vw,9px)", fontWeight: 600, color: p.textMuted }}
              >
                <Lock size={11} strokeWidth={2} style={{ color: p.accent }} />
                Ещё не выдан
              </span>
              <h4 style={{ marginTop: 16, maxWidth: 360, fontSize: "clamp(20px,4.4vw,30px)", lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.035em", color: p.textPrimary }}>
                {lockTitle}
              </h4>
              {lockSubtitle && (
                <p style={{ marginTop: 12, maxWidth: 340, fontSize: 13, lineHeight: 1.5, color: p.textSecondary }}>{lockSubtitle}</p>
              )}
              {onCta && (
                <motion.button
                  onClick={onCta}
                  className="mt-7 inline-flex items-center gap-2"
                  style={{ background: p.textPrimary, color: p.surface, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", padding: "13px 28px", borderRadius: 999 }}
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
      </div>
    </motion.div>
  );
}
