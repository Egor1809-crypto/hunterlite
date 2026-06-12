import Link from "next/link";

/** Shared shell for legal documents — consistent, readable, theme-aware. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px 80px" }}>
        <Link
          href="/"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          ← На главную
        </Link>
        <h1
          style={{
            marginTop: 18,
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {updated ? (
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
            Редакция от {updated}
          </p>
        ) : null}
        <style>{`
          .legal-body h2 { color: var(--text-primary); font-size: 1.15rem; font-weight: 700; margin: 28px 0 10px; letter-spacing: -0.01em; }
          .legal-body h3 { color: var(--text-primary); font-size: 1rem; font-weight: 600; margin: 18px 0 8px; }
          .legal-body p { margin: 0 0 12px; }
          .legal-body ul, .legal-body ol { margin: 0 0 12px; padding-left: 22px; }
          .legal-body li { margin: 0 0 6px; }
          .legal-body a { color: var(--primary); }
          .legal-body b, .legal-body strong { color: var(--text-primary); }
          .legal-body table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 13.5px; }
          .legal-body th, .legal-body td { border: 1px solid var(--border-color); padding: 8px 10px; text-align: left; vertical-align: top; }
          .legal-body th { background: var(--bg-tertiary); color: var(--text-primary); font-weight: 600; }
        `}</style>
        <div
          className="legal-body"
          style={{ marginTop: 24, fontSize: 15, lineHeight: 1.65, color: "var(--text-secondary)" }}
        >
          {children}
        </div>
        <p
          style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: "1px solid var(--border-color)",
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          Документы:{" "}
          <Link href="/legal/privacy" style={{ color: "var(--primary)" }}>Политика ПДн</Link>{" · "}
          <Link href="/legal/cookies" style={{ color: "var(--primary)" }}>Cookie</Link>{" · "}
          <Link href="/legal/consent" style={{ color: "var(--primary)" }}>Согласие на ПДн</Link>{" · "}
          <Link href="/legal/terms" style={{ color: "var(--primary)" }}>Пользовательское соглашение</Link>{" · "}
          <Link href="/legal/offer" style={{ color: "var(--primary)" }}>Оферта</Link>
        </p>
      </div>
    </main>
  );
}
