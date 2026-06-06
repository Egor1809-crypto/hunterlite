"use client";

/**
 * KnowledgeBaseBrowser — full RAG transparency view.
 *
 * 2026-05-04: user requested "видеть всё что AI знает" — every chunk,
 * every question template, every common error, every blitz Q&A — so
 * they can copy any answer and verify the system end-to-end.
 *
 * Backend: GET /api/knowledge/rag/browse?category=&search=&difficulty=
 *
 * Layout: filters on top, then a scroll-list of expandable cards. Each
 * card shows the full chunk: facts, article, hint, common-errors,
 * blitz Q&A, question templates. Every text block is copy-clickable.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Search,
  Copy,
  Check,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

interface RagChunk {
  id: string;
  category: string;
  difficulty: number;
  law_article: string;
  fact_text: string;
  correct_response_hint: string | null;
  common_errors: string[];
  match_keywords: string[];
  question_templates: { text?: string; difficulty?: number }[];
  follow_up_questions: string[];
  blitz_question: string | null;
  blitz_answer: string | null;
  court_case_reference: string | null;
  is_court_practice: boolean;
  tags: string[];
}

interface BrowseResponse {
  chunks: RagChunk[];
  total: number;
  limit: number;
  offset: number;
  by_category: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, string> = {
  eligibility: "Условия подачи",
  procedure: "Процедуры",
  property: "Имущество",
  consequences: "Последствия",
  costs: "Расходы",
  creditors: "Кредиторы",
  documents: "Документы",
  timeline: "Сроки",
  court: "Суд",
  rights: "Права",
};

const PAGE_SIZE = 50;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] uppercase tracking-wide transition-colors"
      style={{
        background: copied ? "var(--success-muted)" : "var(--bg-tertiary)",
        color: copied ? "var(--success)" : "var(--text-muted)",
        border: "1px solid var(--border-color)",
      }}
      title="Скопировать"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "OK" : "копировать"}
    </button>
  );
}

function ChunkCard({ chunk }: { chunk: RagChunk }) {
  const [expanded, setExpanded] = useState(false);
  const catLabel = CATEGORY_LABELS[chunk.category] ?? chunk.category;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:opacity-90 transition-opacity"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="font-medium text-[11px] uppercase tracking-wide px-1.5 py-0.5"
              style={{
                color: "var(--primary)",
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              {catLabel}
            </span>
            <span
              className="font-mono text-[11px] uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              сложность {chunk.difficulty}/5
            </span>
            {chunk.is_court_practice && (
              <span
                className="font-mono text-[11px] uppercase tracking-wide px-1.5 py-0.5"
                style={{
                  color: "var(--primary)",
                  background: "var(--primary-muted)",
                  border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
              >
                судебная практика
              </span>
            )}
          </div>
          <div
            className="text-sm font-medium leading-relaxed line-clamp-2"
            style={{ color: "var(--text-primary)" }}
          >
            {chunk.fact_text}
          </div>
          <div
            className="mt-1 text-xs font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {chunk.law_article}
          </div>
        </div>
        <span className="shrink-0 mt-1" style={{ color: "var(--text-muted)" }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 space-y-3 border-t"
          style={{ borderColor: "var(--border-color)" }}
        >
          {/* Full fact text */}
          <Section
            label="Факт целиком"
            content={chunk.fact_text}
            copyText={chunk.fact_text}
          />

          {/* Article */}
          <Section
            label="Статья"
            content={chunk.law_article}
            copyText={chunk.law_article}
          />

          {/* Correct response hint */}
          {chunk.correct_response_hint && (
            <Section
              label="Эталонный ответ"
              content={chunk.correct_response_hint}
              copyText={chunk.correct_response_hint}
              accent="var(--success)"
            />
          )}

          {/* Common errors */}
          {chunk.common_errors.length > 0 && (
            <div>
              <Header
                label="Частые ошибки"
                accent="var(--warning)"
              />
              <ul className="mt-1.5 space-y-1">
                {chunk.common_errors.map((err, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 text-sm pl-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span>
                      <span style={{ color: "var(--warning)" }}>→ </span>
                      {err}
                    </span>
                    <CopyButton text={err} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blitz Q&A */}
          {(chunk.blitz_question || chunk.blitz_answer) && (
            <div
              className="rounded-lg p-3"
              style={{
                background: "color-mix(in srgb, var(--warning) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--warning) 25%, transparent)",
              }}
            >
              <div
                className="font-medium text-[11px] uppercase tracking-wide mb-2"
                style={{ color: "var(--warning)" }}
              >
                Блиц Q&A
              </div>
              {chunk.blitz_question && (
                <div className="mb-2">
                  <div
                    className="text-[11px] uppercase tracking-wide mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Вопрос
                  </div>
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{chunk.blitz_question}</span>
                    <CopyButton text={chunk.blitz_question} />
                  </div>
                </div>
              )}
              {chunk.blitz_answer && (
                <div>
                  <div
                    className="text-[11px] uppercase tracking-wide mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Эталонный ответ
                  </div>
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <span style={{ color: "var(--success)" }}>{chunk.blitz_answer}</span>
                    <CopyButton text={chunk.blitz_answer} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question templates */}
          {chunk.question_templates.length > 0 && (
            <div>
              <Header label="Вопросы" accent="var(--primary)" />
              <ul className="mt-1.5 space-y-1">
                {chunk.question_templates.map((tmpl, i) => {
                  const text = typeof tmpl === "string" ? tmpl : tmpl?.text || "";
                  if (!text) return null;
                  return (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 text-sm pl-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span>
                        <span style={{ color: "var(--primary)" }}>{i + 1}. </span>
                        {text}
                        {typeof tmpl === "object" && tmpl.difficulty && (
                          <span
                            className="ml-2 text-[11px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            (D{tmpl.difficulty})
                          </span>
                        )}
                      </span>
                      <CopyButton text={text} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Follow-up questions */}
          {chunk.follow_up_questions.length > 0 && (
            <div>
              <Header label="Углубляющие вопросы" accent="var(--primary)" />
              <ul className="mt-1.5 space-y-1">
                {chunk.follow_up_questions.map((q, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 text-sm pl-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span>
                      <span style={{ color: "var(--primary)" }}>{i + 1}. </span>
                      {q}
                    </span>
                    <CopyButton text={q} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Match keywords */}
          {chunk.match_keywords.length > 0 && (
            <div>
              <Header label="Ключевые слова" accent="var(--text-muted)" />
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-3">
                {chunk.match_keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Court case reference */}
          {chunk.court_case_reference && (
            <Section
              label="Судебная практика"
              content={chunk.court_case_reference}
              copyText={chunk.court_case_reference}
              accent="var(--primary)"
            />
          )}

          {/* Tags */}
          {chunk.tags.length > 0 && (
            <div className="pt-2 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              теги: {chunk.tags.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      className="font-medium text-[11px] uppercase tracking-wide"
      style={{ color: accent }}
    >
      {label}
    </div>
  );
}

function Section({
  label,
  content,
  copyText,
  accent = "var(--text-muted)",
}: {
  label: string;
  content: string;
  copyText: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Header label={label} accent={accent} />
        <CopyButton text={copyText} />
      </div>
      <div
        className="mt-1 text-sm leading-relaxed pl-3"
        style={{ color: "var(--text-primary)" }}
      >
        {content}
      </div>
    </div>
  );
}

export function KnowledgeBaseBrowser({ initialCategory }: { initialCategory?: string } = {}) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>(() => initialCategory ?? searchParams.get("category") ?? "");
  const [search, setSearch] = useState<string>(() => searchParams.get("search") ?? "");
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  // Filter reliably when the parent selects a topic (no URL+remount race).
  useEffect(() => {
    if (initialCategory !== undefined) {
      setCategory(initialCategory);
      setOffset(0);
    }
  }, [initialCategory]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (search.trim()) params.set("search", search.trim());
      if (difficulty) params.set("difficulty", String(difficulty));
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      const resp = await api.get<BrowseResponse>(`/knowledge/rag/browse?${params}`);
      setData(resp);
    } catch (err) {
      logger.error("rag browse failed", err);
      setData({ chunks: [], total: 0, limit: PAGE_SIZE, offset: 0, by_category: {} });
    } finally {
      setLoading(false);
    }
  }, [category, search, difficulty, offset]);

  useEffect(() => {
    // Debounce search to avoid hammering the endpoint on every keystroke.
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const categoryStats = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_category).sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2.5">
          <BookOpen size={13} style={{ color: "var(--text-muted)" }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
            Справочник ФЗ-127
          </span>
          <div className="h-px flex-1" style={{ background: "var(--border-color)" }} />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: 560 }}>
          Все факты, статьи и эталонные ответы по банкротству физлиц. Любой текст можно скопировать.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
          }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Поиск по факту / статье / блиц-вопросу…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)" }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCategory("");
              setOffset(0);
            }}
            className="px-2.5 py-1 text-[11px] uppercase tracking-wide font-medium"
            style={{
              background: !category ? "var(--primary)" : "var(--bg-panel)",
              color: !category ? "#fff" : "var(--text-muted)",
              border: `1px solid ${!category ? "var(--primary)" : "var(--border-color)"}`,
              borderRadius: 8,
            }}
          >
            все ({data?.total ?? 0})
          </button>
          {categoryStats.map(([cat, n]) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(active ? "" : cat);
                  setOffset(0);
                }}
                className="px-2.5 py-1 text-[11px] uppercase tracking-wide font-medium"
                style={{
                  background: active ? "var(--primary)" : "var(--bg-panel)",
                  color: active ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${active ? "var(--primary)" : "var(--border-color)"}`,
                  borderRadius: 8,
                }}
              >
                {CATEGORY_LABELS[cat] ?? cat} ({n})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span
            className="font-medium text-[11px] uppercase tracking-wide self-center mr-1"
            style={{ color: "var(--text-muted)" }}
          >
            Сложность
          </span>
          {[null, 1, 2, 3, 4, 5].map((d) => {
            const active = difficulty === d;
            const label = d === null ? "все" : `${d}/5`;
            return (
              <button
                key={String(d)}
                type="button"
                onClick={() => {
                  setDifficulty(d);
                  setOffset(0);
                }}
                className="px-2 py-0.5 text-[11px] uppercase tracking-wide font-medium"
                style={{
                  background: active ? "var(--warning)" : "var(--bg-panel)",
                  color: active ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${active ? "var(--warning)" : "var(--border-color)"}`,
                  borderRadius: 8,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      ) : !data || data.chunks.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-color)",
          }}
        >
          <AlertTriangle size={24} style={{ color: "var(--text-muted)" }} className="mx-auto mb-2" />
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            По текущим фильтрам ничего не найдено.
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span>
              {data.total} фактов · показано {data.chunks.length}
            </span>
            {totalPages > 1 && (
              <span>
                стр. {currentPage} из {totalPages}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {data.chunks.map((c) => (
              <ChunkCard key={c.id} chunk={c} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide disabled:opacity-40"
                style={{
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  color: "var(--text-secondary)",
                }}
              >
                ← назад
              </button>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide disabled:opacity-40"
                style={{
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  color: "var(--text-secondary)",
                }}
              >
                вперёд →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
