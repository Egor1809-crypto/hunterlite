"use client";

/**
 * ManyashaTab — встроенный (in-tab) чат Маняши для вкладки «AI-помощник»
 * страницы /knowledge (ТЗ-3 DECISION-A).
 *
 * В отличие от плавающего ManyashaChat, это полноэкранная панель внутри
 * вкладки: маскот-аватар, пузыри, индикатор «печатает», быстрые вопросы,
 * список именованных бесед и серверная память (беседы грузятся с бэка,
 * не из sessionStorage). Ответы показывают кликабельные источники.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  FileText,
  Scale,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";

const MASCOT_VIDEO = "/mascot/manyasha-idle-alpha.webm";
const MASCOT_POSTER = "/mascot/manyasha-idle-poster.jpg";

const QUICK_QUESTIONS = [
  "Подходит ли мне банкротство физлица?",
  "Какие нужны документы для БФЛ?",
  "Что будет с долгами после банкротства?",
  "Чем грозит реализация имущества?",
];

interface Source {
  id: string;
  category: string;
  law_article: string;
  relevance: number;
  is_court_practice: boolean;
  court_case: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  used_chunks: Source[];
  grounded?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

interface ConversationDetail {
  id: string;
  title: string;
  messages: ChatMsg[];
}

interface SendResponse {
  message_id: string;
  conversation_id: string;
  content: string;
  status: string;
  used_chunks: Source[];
  grounded: boolean;
  model: string;
}

function MascotAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 0 1px var(--primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <video
        src={MASCOT_VIDEO}
        poster={MASCOT_POSTER}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(2.45) translateY(10%)",
          transformOrigin: "50% 42%",
        }}
      />
    </span>
  );
}

export function ManyashaTab({ onOpenSource }: { onOpenSource?: (category: string) => void }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Id of a conversation we just created locally in send(). The load effect
  // below must NOT overwrite that conversation's optimistic local messages with
  // a server GET that can race ahead of the message POST and return [] — which
  // previously erased the first user bubble (ultracode FE finding §8).
  const justCreatedRef = useRef<string | null>(null);

  // ── Load conversation list; default = most recently active (DECISION-B) ──
  useEffect(() => {
    api
      .get<ConversationSummary[]>("/knowledge-ai/conversations")
      .then((list) => {
        setConversations(list);
        if (list.length > 0) setActiveId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Load messages when active conversation changes ──
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    // Freshly-created conversation: local state is the source of truth; skip
    // the reload that would race the first message POST and wipe the bubble.
    if (justCreatedRef.current === activeId) return;
    api
      .get<ConversationDetail>(`/knowledge-ai/conversations/${activeId}`)
      .then((d) => setMessages(d.messages))
      .catch(() => setMessages([]));
  }, [activeId]);

  // Selecting an existing conversation from the list must reload its messages,
  // so clear the just-created guard first.
  const selectConversation = useCallback((id: string) => {
    justCreatedRef.current = null;
    setActiveId(id);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const newConversation = useCallback(() => {
    justCreatedRef.current = null;
    setActiveId(null);
    setMessages([]);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const deleteConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await api.delete(`/knowledge-ai/conversations/${id}`);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }
      } catch {
        /* ignore */
      }
    },
    [activeId],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || sending) return;

      setError(null);
      setInput("");
      setSending(true);

      // Optimistic user bubble.
      const tempId = `temp-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: tempId, role: "user", content: q, status: "ok", used_chunks: [] },
      ]);

      let createdConvId: string | null = null;
      try {
        // Ensure a conversation exists.
        let convId = activeId;
        if (!convId) {
          const created = await api.post<ConversationSummary>("/knowledge-ai/conversations", {});
          convId = created.id;
          createdConvId = convId;
          justCreatedRef.current = convId;  // guard the load effect (§8)
          setActiveId(convId);
          setConversations((prev) => [created, ...prev]);
        }

        const res = await api.post<SendResponse>(
          `/knowledge-ai/conversations/${convId}/messages`,
          { message: q },
        );

        setMessages((prev) => [
          ...prev,
          {
            id: res.message_id,
            role: "assistant",
            content: res.content,
            status: res.status,
            used_chunks: res.used_chunks ?? [],
            grounded: res.grounded,
          },
        ]);

        // Refresh the conversation list so the auto-title appears.
        api
          .get<ConversationSummary[]>("/knowledge-ai/conversations")
          .then(setConversations)
          .catch(() => {});
      } catch {
        setError("Не удалось отправить сообщение. Проверьте соединение и попробуйте ещё раз.");
        // Roll back the optimistic bubble.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(q);
        // If we created the conversation in THIS call and the message POST
        // failed, don't leave an orphan empty thread with a stuck load guard
        // (ultracode failure-path finding): drop it client- and server-side.
        if (createdConvId) {
          const orphan = createdConvId;
          setActiveId(null);
          setConversations((prev) => prev.filter((c) => c.id !== orphan));
          justCreatedRef.current = null;
          api.delete(`/knowledge-ai/conversations/${orphan}`).catch(() => {});
        }
      } finally {
        setSending(false);
      }
    },
    [activeId, sending],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* ── Conversation list ── */}
      <div className="space-y-2">
        <button
          onClick={newConversation}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ background: "var(--primary-muted)", color: "var(--primary)", border: "1px solid var(--primary)" }}
        >
          <Plus size={15} /> Новый диалог
        </button>
        <div className="space-y-1.5">
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => selectConversation(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectConversation(c.id);
                  }
                }}
                className="group flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  background: active ? "var(--primary-muted)" : "var(--surface-card)",
                  border: `1px solid ${active ? "var(--primary)" : "var(--border-color)"}`,
                }}
              >
                <MessageSquare size={13} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="flex-1 truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {c.title}
                </span>
                <button
                  onClick={(e) => deleteConversation(c.id, e)}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Удалить беседу"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <Card accentTop padded={false}>
        <div className="flex h-[560px] flex-col">
          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center py-10 text-center">
                <MascotAvatar size={72} />
                <p className="mt-4 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Привет! Я Маняша 👋
                </p>
                <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Помогу разобраться с банкротством физлиц: процедура, документы, долги, сроки. Спрашивайте — отвечу со ссылками на закон.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-full px-3.5 py-1.5 text-[12px] transition-colors"
                      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <MascotAvatar size={28} />}
                <div className="max-w-[80%]">
                  <div
                    className="whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed"
                    style={
                      m.role === "user"
                        ? { background: "var(--primary-muted)", color: "var(--text-primary)", borderBottomRightRadius: 6 }
                        : {
                            background: "var(--bg-secondary)",
                            color: m.status === "failed" ? "var(--danger)" : "var(--text-secondary)",
                            border: "1px solid var(--border-color)",
                            borderBottomLeftRadius: 6,
                          }
                    }
                  >
                    {m.content}
                  </div>

                  {/* Source links */}
                  {m.role === "assistant" && m.used_chunks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.used_chunks.slice(0, 8).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onOpenSource?.(s.category)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors"
                          style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                          title={`Открыть в справочнике: ${s.category}`}
                        >
                          {s.is_court_practice ? <Scale size={10} /> : <FileText size={10} />}
                          {s.law_article || s.category}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Ungrounded answer hint (ТЗ §7а): ok reply with no sources */}
                  {m.role === "assistant" && m.status === "ok" && m.used_chunks.length === 0 && m.grounded === false && (
                    <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <Info size={10} /> ответ без ссылок на базу знаний — сверьтесь с первоисточником
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-end gap-2">
                <MascotAvatar size={28} />
                <div className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderBottomLeftRadius: 6 }}>
                  <Loader2 size={15} className="animate-spin" style={{ color: "var(--primary)" }} />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {error && (
            <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: "var(--primary-muted)", color: "var(--danger)" }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Input */}
          <form
            className="flex items-center gap-2 border-t p-3"
            style={{ borderColor: "var(--border-color)" }}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите Маняшу о банкротстве физлиц…"
              disabled={sending}
              maxLength={8000}
              className="vh-input flex-1"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40"
              style={{ background: "var(--primary)", color: "#fff" }}
              aria-label="Отправить"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
