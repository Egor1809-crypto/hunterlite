"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

/* ── Palette (editorial / malvah-abstract) ─────────────────── */
const PAPER = "#F2F0EB";
const INK = "#16140F";
const INK_SOFT = "#5C574E";
const INK_FAINT = "#928C81";
const RULE = "rgba(22,20,15,0.12)";
const RIGHT = "#1F5C46";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface CaseListItem {
  id: string;
  code: string;
  title: string;
  description: string;
  difficulty: number;
  category: string;
  estimated_minutes: number;
  max_score: number;
  order_index: number;
  completed: boolean;
  best_score: number | null;
  attempts: number;
}
interface CaseListResponse {
  cases: CaseListItem[];
  stats: {
    total: number;
    completed: number;
    average_score: number | null;
    total_attempts: number;
  };
}

function MonoLabel({ children, color = INK_FAINT }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.18em", color }}>
      {children}
    </span>
  );
}

export default function CasesPage() {
  const router = useRouter();
  const [data, setData] = useState<CaseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<CaseListResponse>("/cases/")
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cases = data?.cases ?? [];
  const stats = data?.stats ?? { total: 0, completed: 0, average_score: null, total_attempts: 0 };

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div style={{ background: PAPER, color: INK, minHeight: "100vh" }}>
        <div className="mx-auto max-w-[920px] px-6 sm:px-10 py-12 sm:py-20">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <div className="flex items-center justify-between">
              <MonoLabel>Практикум · банкротство физлиц</MonoLabel>
              <MonoLabel>ФЗ-127</MonoLabel>
            </div>
            <h1
              className="font-display mt-6"
              style={{ fontSize: "clamp(44px,9vw,92px)", lineHeight: 0.95, letterSpacing: "-0.05em", fontWeight: 600 }}
            >
              Кейсы
            </h1>
            <div className="mt-6" style={{ fontSize: 18, lineHeight: 1.55, color: INK_SOFT, maxWidth: 560 }}>
              Реальная практика БФЛ в два этапа: дерево решений внесудебной оценки и хронология
              судебной процедуры. Только то, что встречается в работе.
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
            className="mt-12 mb-2"
          >
            <div style={{ height: 1, background: RULE }} />
            <div className="grid grid-cols-3 py-6">
              {[
                ["Кейсов", String(stats.total)],
                ["Пройдено", `${stats.completed} / ${stats.total}`],
                ["Средний балл", stats.average_score != null ? `${Math.round(stats.average_score)}%` : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <MonoLabel>{k}</MonoLabel>
                  <div className="mt-2 font-display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: RULE }} />
          </motion.div>

          {/* Index */}
          {loading ? (
            <p className="font-mono mt-12" style={{ fontSize: 13, color: INK_FAINT }}>
              загрузка…
            </p>
          ) : cases.length === 0 ? (
            <p className="mt-12" style={{ fontSize: 15, color: INK_FAINT }}>
              Кейсы скоро появятся.
            </p>
          ) : (
            <div className="mt-8">
              {cases.map((c, i) => {
                const isHover = hovered === c.id;
                return (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 + i * 0.05, ease: EASE }}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => router.push(`/cases/${c.id}`)}
                    className="w-full text-left block"
                    style={{ borderTop: `1px solid ${RULE}`, borderBottom: i === cases.length - 1 ? `1px solid ${RULE}` : "none" }}
                  >
                    <div className="flex items-baseline gap-5 sm:gap-8 py-7 sm:py-9 px-1">
                      <span className="font-mono shrink-0" style={{ fontSize: 12, color: INK_FAINT, letterSpacing: "0.1em", minWidth: 64 }}>
                        {c.code}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2
                            className="font-display"
                            style={{
                              fontSize: "clamp(22px,3.2vw,32px)",
                              lineHeight: 1.1,
                              letterSpacing: "-0.03em",
                              fontWeight: 600,
                              color: INK,
                              transition: "opacity .3s",
                              opacity: isHover ? 0.55 : 1,
                            }}
                          >
                            {c.title}
                          </h2>
                          {c.completed && <MonoLabel color={RIGHT}>пройден</MonoLabel>}
                        </div>
                        <p className="mt-2.5" style={{ fontSize: 15, lineHeight: 1.55, color: INK_SOFT, maxWidth: 600 }}>
                          {c.description}
                        </p>
                        <div className="mt-4 flex items-center gap-5 flex-wrap">
                          <MonoLabel>{c.category}</MonoLabel>
                          <MonoLabel>≈ {c.estimated_minutes} мин</MonoLabel>
                          {c.attempts > 0 && <MonoLabel>попыток · {c.attempts}</MonoLabel>}
                          {c.best_score != null && <MonoLabel color={INK_SOFT}>лучший · {c.best_score}%</MonoLabel>}
                        </div>
                      </div>
                      <span
                        className="shrink-0 self-center"
                        style={{
                          fontSize: 26,
                          color: INK,
                          transition: "transform .3s",
                          transform: isHover ? "translateX(6px)" : "translateX(0)",
                        }}
                      >
                        →
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
            style={{ fontSize: 13, color: INK_FAINT, lineHeight: 1.6 }}
          >
            Кейсы построены строго на действующей практике банкротства физических лиц.
          </motion.p>
        </div>
      </div>
    </AuthLayout>
  );
}
