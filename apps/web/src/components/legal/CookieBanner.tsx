"use client";

// 152-ФЗ / РКН cookie banner. Appears on first visit, before any non-essential
// cookies run. Gives a real choice — equal "Принять" / "Отклонить" buttons
// (a bare "OK" is a violation) — and links to the cookie/privacy policy.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/cookieConsent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show only when the user has not decided yet.
    if (getConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (value: "accepted" | "rejected") => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление об использовании cookie"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        margin: "0 auto",
        maxWidth: 720,
        background: "var(--surface-card)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-color)",
        borderRadius: 16,
        boxShadow: "var(--shadow-lg)",
        padding: "16px 18px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--font-geist-sans), -apple-system, sans-serif",
      }}
    >
      <p style={{ flex: "1 1 280px", margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        Мы используем cookie. Технически необходимые — для работы сайта; аналитические и
        иные — только с вашего согласия. Подробнее в{" "}
        <Link href="/legal/cookies" style={{ color: "var(--primary)", textDecoration: "underline" }}>
          Политике cookie
        </Link>{" "}
        и{" "}
        <Link href="/legal/privacy" style={{ color: "var(--primary)", textDecoration: "underline" }}>
          Политике обработки ПДн
        </Link>
        .
      </p>
      <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
        <button
          onClick={() => decide("rejected")}
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Отклонить
        </button>
        <button
          onClick={() => decide("accepted")}
          style={{
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--primary)",
            color: "var(--primary-contrast, #fff)",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Принять
        </button>
      </div>
    </div>
  );
}
