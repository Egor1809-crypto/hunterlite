"use client";

/**
 * ManyashaChat — самостоятельный плавающий чат-виджет с маскотом.
 *
 * ВАЖНО: этот вариант НЕ зависит от Tailwind хост-проекта. Все стили виджет
 * вшивает сам (один <style> в <head>), поэтому выглядит ОДИНАКОВО в любом
 * React/Next-проекте — ничего настраивать в tailwind.config не нужно.
 *
 * Логика 1:1 с боевым виджетом AI Legal Academy:
 *  • клик по маскоту открывает/закрывает чат;
 *  • зажал и тащишь — маскот перемещается (с привязкой к границам экрана);
 *  • кнопка ⤢ переключает размер маскота по кругу;
 *  • окно чата можно растягивать за угол;
 *  • позиция/размер/размер окна запоминаются в localStorage между страницами;
 *  • быстрые вопросы, индикатор «печатает», ссылка в Telegram;
 *  • опциональная озвучка ответов (TTS) — см. проп `onSpeak`.
 *
 * Единственное, что нужно положить руками, — два файла маскота в public/mascot/
 * (или передать свои пути в config.mascotVideo / config.mascotPoster).
 *
 * Минимальная встройка:
 *   <ManyashaChat config={{ apiEndpoint: "/api/chat" }} />
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";
import { useAssistantHidden } from "@/lib/assistantPrefs";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ManyashaConfig {
  /** Куда слать историю сообщений (POST { messages }). Ответ: { reply }. */
  apiEndpoint: string;
  /** Имя в шапке чата. */
  botName?: string;
  /** Подзаголовок-статус под именем. */
  statusText?: string;
  /** Приветствие на пустом экране чата. */
  greetingTitle?: string;
  greetingSubtitle?: string;
  /** Кнопки быстрых вопросов. */
  quickQuestions?: string[];
  /** Ссылка «Продолжить в Telegram» (если не нужна — передай null). */
  telegramUrl?: string | null;
  /** Видео маскота (webm с альфой) и постер-картинка. */
  mascotVideo?: string;
  mascotPoster?: string;
  /** Подсказка-облачко над маскотом, когда чат закрыт. */
  hint?: string;
  /** На каких путях скрывать виджет (startsWith). Напр. ["/", "/cabinet"]. */
  hidePaths?: string[];
  /** Палитра — можно переопределить под свой бренд (см. DEFAULT_THEME). */
  theme?: Partial<Theme>;
}

interface Theme {
  navy800: string;
  navy900: string;
  accent: string; // основной (в боевом проекте — голубой #00CFFF)
  accentSoft: string; // светлый оттенок акцента (текст в пузыре юзера)
  magenta: string; // вторичный градиент кнопки (#FF007A)
  online: string; // цвет точки «онлайн»
}

const DEFAULT_THEME: Theme = {
  navy800: "#0a1628",
  navy900: "#050d1a",
  accent: "#00CFFF",
  accentSoft: "#cdeffd",
  magenta: "#FF007A",
  online: "#34d399",
};

interface Props {
  config: ManyashaConfig;
  /** Колбэк озвучки ответа ассистента: (text) => speak(text) из useTTS. */
  onSpeak?: (text: string) => void;
}

const DEFAULTS: Required<
  Omit<ManyashaConfig, "apiEndpoint" | "telegramUrl" | "theme">
> & { telegramUrl: string | null } = {
  botName: "Маняша",
  statusText: "AI-помощник · онлайн",
  greetingTitle: "Привет! Я Маняша 👋",
  greetingSubtitle:
    "Помогу разобраться с БФЛ, долгами, процедурой и документами. Спрашивайте!",
  quickQuestions: ["Подходит ли мне БФЛ?", "Какие нужны документы?", "Что будет с долгами?"],
  telegramUrl: "https://t.me/ailegal_academy_bot",
  mascotVideo: "/mascot/manyasha-idle-alpha.webm",
  mascotPoster: "/mascot/manyasha-idle-poster.jpg",
  hint: "Нужна помощь?",
  hidePaths: ["/"],
};

// Маняшу можно увеличивать самому — три размера по кругу.
const SIZES = [180, 260, 360];
const DRAG_THRESHOLD = 6; // px — отличаем «клик» (открыть чат) от «перетащить»

// Размеры окна чата (пользователь может менять, значения запоминаются)
const CHAT_DEFAULT = { w: 360, h: 460 };
const CHAT_MIN = { w: 300, h: 320 };
const CHAT_MAX = { w: 560, h: 680 };

// Ключи для запоминания состояния между страницами
const LS_POS = "manyasha.pos";
const LS_SIZE = "manyasha.sizeIdx";
const LS_CHAT = "manyasha.chat";

const STYLE_ID = "manyasha-widget-styles";

/**
 * Стили виджета — вшиваются в <head> один раз. Полностью на токенах платформы
 * (var(--surface-card), var(--text-primary), var(--primary)…), поэтому чат
 * АВТОМАТИЧЕСКИ следует теме: светлый в светлой, тёмный в тёмной — без неона,
 * циана и маженты. Маскот статичен (см. FrozenMascot), декоративное свечение
 * и «сетка» убраны.
 */
function styleSheet(): string {
  return `
.mnya-root { position: fixed; bottom: 24px; right: 24px; z-index: 50;
  font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.mnya-root * { box-sizing: border-box; }

.mnya-window {
  position: absolute; right: 0;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 20px; box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; overflow: hidden;
  animation: mnya-fadeIn .22s cubic-bezier(.16,1,.3,1);
}

.mnya-resize { position: absolute; top: 0; left: 0; width: 22px; height: 22px; z-index: 20;
  cursor: nwse-resize; display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); opacity: .45; }
.mnya-resize:hover { opacity: 1; color: var(--text-secondary); }

.mnya-header { position: relative; display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.mnya-grid { display: none; }
.mnya-avatar { position: relative; width: 40px; height: 40px; border-radius: 9999px; overflow: hidden;
  box-shadow: 0 0 0 1px var(--border-color); flex-shrink: 0; background: var(--bg-tertiary); }
.mnya-avatar-video {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
  transform: scale(2.45) translateY(10%); transform-origin: 50% 42%;
  display: block; background: transparent;
}
.mnya-head-text { position: relative; flex: 1; min-width: 0; }
.mnya-name { font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.2; margin: 0; }
.mnya-status { font-size: 11px; color: var(--text-muted); font-weight: 500;
  display: flex; align-items: center; gap: 6px; margin: 0; }
.mnya-dot { position: relative; display: flex; height: 6px; width: 6px; }
.mnya-dot-ping { position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px;
  background: var(--success); opacity: .6; animation: mnya-ping 1.6s cubic-bezier(0,0,.2,1) infinite; }
.mnya-dot-core { position: relative; display: inline-flex; border-radius: 9999px; height: 6px; width: 6px; background: var(--success); }
.mnya-close { position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); background: transparent; border: 0; border-radius: 9999px; cursor: pointer; transition: .15s; flex-shrink: 0; }
.mnya-close:hover { color: var(--text-primary); background: var(--bg-tertiary); }

.mnya-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 0; background: var(--bg-primary); }
.mnya-greet { text-align: center; padding: 20px 0; }
.mnya-greet-avatar { width: 60px; height: 60px; margin: 0 auto 12px; border-radius: 9999px; overflow: hidden;
  box-shadow: 0 0 0 1px var(--border-color); background: var(--bg-tertiary); }
.mnya-greet-avatar .mnya-avatar-video { transform: scale(2.3) translateY(10%); }
.mnya-greet-title { color: var(--text-primary); font-size: 15px; font-weight: 600; margin: 0; }
.mnya-greet-sub { color: var(--text-muted); font-size: 12px; margin: 6px auto 0; max-width: 240px; line-height: 1.5; }
.mnya-quick { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 18px; }
.mnya-quick button { padding: 8px 14px; font-size: 12px; background: var(--surface-card);
  border: 1px solid var(--border-color); color: var(--text-secondary); border-radius: 9999px; cursor: pointer; transition: .15s; }
.mnya-quick button:hover { border-color: var(--primary); background: var(--primary-muted); color: var(--primary); }

.mnya-row { display: flex; align-items: flex-end; gap: 8px; justify-content: flex-start; }
.mnya-row-user { justify-content: flex-end; }
.mnya-msg-avatar { width: 26px; height: 26px; border-radius: 9999px; overflow: hidden;
  box-shadow: 0 0 0 1px var(--border-color); background: var(--bg-tertiary); flex-shrink: 0; }
.mnya-msg-avatar .mnya-avatar-video { transform: scale(2.55) translateY(10%); }
.mnya-bubble { max-width: 80%; padding: 9px 13px; font-size: 14px; line-height: 1.5; }
.mnya-bubble-bot { background: var(--surface-card); color: var(--text-primary);
  border-radius: 14px; border-bottom-left-radius: 5px; border: 1px solid var(--border-color); }
.mnya-bubble-user { background: var(--primary); color: #fff;
  border-radius: 14px; border-bottom-right-radius: 5px; }

.mnya-typing { background: var(--surface-card); border: 1px solid var(--border-color);
  padding: 11px 15px; border-radius: 14px; border-bottom-left-radius: 5px; }
.mnya-typing .d { display: inline-flex; gap: 4px; }
.mnya-typing .d span { width: 7px; height: 7px; background: var(--text-muted);
  border-radius: 9999px; animation: mnya-bounce 1s infinite; }

.mnya-input-area { padding: 12px; border-top: 1px solid var(--border-color);
  background: var(--surface-card); flex-shrink: 0; }
.mnya-input-row { display: flex; gap: 8px; align-items: center; }
.mnya-input { flex: 1; background: var(--input-bg); border: 1px solid var(--input-border);
  border-radius: 9999px; padding: 10px 16px; font-size: 14px; color: var(--text-primary); outline: none; transition: .15s; }
.mnya-input::placeholder { color: var(--text-muted); }
.mnya-input:focus { border-color: var(--primary); }
.mnya-input:disabled { opacity: .5; }
.mnya-send { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  background: var(--primary); color: #fff; border: 0; border-radius: 9999px; cursor: pointer; transition: .15s; flex-shrink: 0; }
.mnya-send:hover:not(:disabled) { background: var(--primary-hover); }
.mnya-send:disabled { opacity: .4; cursor: not-allowed; }
.mnya-tg { display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 10px; padding: 6px 0; font-size: 11px; color: var(--text-muted); text-decoration: none; transition: .15s; }
.mnya-tg:hover { color: var(--primary); }

.mnya-mascot { position: relative; user-select: none; touch-action: none; }
.mnya-size-btn { position: absolute; top: 4px; right: 4px; z-index: 10; width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-card); border: 1px solid var(--border-color); color: var(--text-secondary);
  border-radius: 9999px; cursor: pointer; transition: .15s; box-shadow: var(--shadow-sm); opacity: 0; }
.mnya-mascot:hover .mnya-size-btn { opacity: 1; }
.mnya-size-btn:hover { color: var(--primary); border-color: var(--primary); }
.mnya-glow, .mnya-glow-a, .mnya-glow-b { display: none; }
.mnya-video-wrap { position: relative; z-index: 1; cursor: grab; }
.mnya-video-wrap.dragging { cursor: grabbing; }
.mnya-video { width: 100%; height: auto; pointer-events: none; background: transparent; display: block; }

.mnya-hint { position: absolute; top: -8px; left: 50%; transform: translate(-50%, -100%);
  pointer-events: none; z-index: 10; }
.mnya-hint-box { position: relative; background: var(--surface-card);
  border: 1px solid var(--border-color); box-shadow: var(--shadow-md);
  padding: 8px 12px; font-size: 12px; color: var(--text-primary); border-radius: 10px; white-space: nowrap; }
.mnya-hint-tail { position: absolute; left: 50%; transform: translateX(-50%) rotate(45deg); bottom: -5px;
  width: 9px; height: 9px; background: var(--surface-card);
  border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }

@media (max-width: 768px) {
  .mnya-root { right: 12px; bottom: 12px; }
  .mnya-size-btn { display: none; }
  .mnya-hint-box { font-size: 11px; padding: 7px 10px; }
  .mnya-window {
    width: min(340px, calc(100vw - 24px)) !important;
    height: min(520px, calc(100vh - 160px)) !important;
  }
}

@keyframes mnya-fadeIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes mnya-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
@keyframes mnya-bounce { 0%,100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,.2,1); } }
`;
}

function useInjectStyles() {
  useEffect(() => {
    // ВАЖНО: всегда перезаписываем содержимое. Раньше делали early-return при
    // существующем элементе — из-за этого старый (неоновый) style-sheet
    // «прилипал» в <head> и новая токен-тема не применялась (чат оставался
    // тёмным даже в светлой теме платформы) до жёсткой перезагрузки.
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = styleSheet();
  }, []);
}

/**
 * Замораживает видео-маскот на одном кадре (прозрачность webm сохраняется,
 * в отличие от непрозрачного jpg-постера). autoPlay заставляет браузер
 * декодировать и отрисовать кадр, после чего сразу ставим на паузу → маскот
 * статичен, ничего не «дёргается».
 */
function freezeFrame(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  try {
    v.pause();
    v.currentTime = v.duration && isFinite(v.duration) ? Math.min(0.5, v.duration / 2) : 0.4;
  } catch {
    /* ignore */
  }
}

function ManyashaAvatar({
  video,
  poster,
  name,
}: {
  video: string;
  poster: string;
  name?: string;
}) {
  return (
    <video
      src={video}
      poster={poster}
      muted
      playsInline
      autoPlay
      preload="auto"
      draggable={false}
      className="mnya-avatar-video"
      aria-label={name}
      onLoadedData={freezeFrame}
      onPlay={(e) => { try { e.currentTarget.pause(); } catch { /* ignore */ } }}
    />
  );
}

export default function ManyashaChat({ config, onSpeak }: Props) {
  const cfg = { ...DEFAULTS, ...config };
  const theme = { ...DEFAULT_THEME, ...(config.theme ?? {}) };

  useInjectStyles();

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [chatSize, setChatSize] = useState(CHAT_DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const [pathname, setPathname] = useState<string | null>(null);
  const [compactViewport, setCompactViewport] = useState(false);
  const [assistantHidden] = useAssistantHidden();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef({ startX: 0, startY: 0, baseX: 0, baseY: 0, moved: false });
  const resizeState = useRef({ startX: 0, startY: 0, baseW: 0, baseH: 0 });

  // Путь читаем из браузера, без привязки к роутеру фреймворка.
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  useEffect(() => {
    const syncViewport = () => setCompactViewport(window.innerWidth < 768);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const hideWidget =
    pathname !== null &&
    (cfg.hidePaths ?? []).some((p) =>
      p === "/" ? pathname === "/" : pathname.startsWith(p),
    );

  const mascotWidth = compactViewport ? Math.min(SIZES[sizeIdx], 92) : SIZES[sizeIdx];
  const chatBottom = Math.round(mascotWidth * 0.62) + 8;

  // ── Загрузка сохранённого состояния (один раз) ──
  useEffect(() => {
    try {
      const p = localStorage.getItem(LS_POS);
      if (p) {
        const parsed = JSON.parse(p);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") setPos(parsed);
      }
      const s = localStorage.getItem(LS_SIZE);
      if (s !== null) {
        const idx = Number(s);
        if (idx >= 0 && idx < SIZES.length) setSizeIdx(idx);
      }
      const c = localStorage.getItem(LS_CHAT);
      if (c) {
        const parsed = JSON.parse(c);
        if (typeof parsed.w === "number" && typeof parsed.h === "number") setChatSize(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // ── Сохранение состояния ──
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_POS, JSON.stringify(pos));
  }, [pos, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_SIZE, String(sizeIdx));
  }, [sizeIdx, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_CHAT, JSON.stringify(chatSize));
  }, [chatSize, hydrated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (chatOpen && inputRef.current) inputRef.current.focus();
  }, [chatOpen]);

  const sendChatMessage = useCallback(
    async (text: string, currentMessages: ChatMessage[]) => {
      if (!text || loading) return;

      const userMsg: ChatMessage = { role: "user", content: text };
      const newMessages = [...currentMessages, userMsg];
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch(cfg.apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
        });

        const data = await res.json();
        const reply = data.reply ?? "Извините, произошла ошибка.";

        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        onSpeak?.(reply);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Не могу подключиться к серверу. Попробуйте позже." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, cfg.apiEndpoint, onSpeak],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (text) sendChatMessage(text, messages);
  }, [input, messages, sendChatMessage]);

  const handleQuickQuestion = useCallback(
    (q: string) => sendChatMessage(q, messages),
    [messages, sendChatMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const cycleSize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSizeIdx((i) => (i + 1) % SIZES.length);
  }, []);

  // ── Перетаскивание Маняши ──
  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = {
      startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    st.moved = true;
    setDragging(true);

    let nextX = st.baseX + dx;
    let nextY = st.baseY + dy;
    const margin = 12;
    const minX = -(window.innerWidth - mascotWidth - margin);
    const minY = -(window.innerHeight - mascotWidth - margin);
    nextX = Math.min(margin, Math.max(minX, nextX));
    nextY = Math.min(margin, Math.max(minY, nextY));
    setPos({ x: nextX, y: nextY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const st = dragState.current;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (!st.moved) setChatOpen((prev) => !prev);
    setDragging(false);
  };

  // ── Изменение размера окна чата ──
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    resizeState.current = {
      startX: e.clientX, startY: e.clientY, baseW: chatSize.w, baseH: chatSize.h,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const st = resizeState.current;
    const w = Math.min(CHAT_MAX.w, Math.max(CHAT_MIN.w, st.baseW - (e.clientX - st.startX)));
    const h = Math.min(CHAT_MAX.h, Math.max(CHAT_MIN.h, st.baseH - (e.clientY - st.startY)));
    setChatSize({ w, h });
  };
  const onResizeUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (hideWidget || assistantHidden) return null;

  const rootStyle: CSSProperties = {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    // CSS-переменные темы — отсюда их читает вшитый style-sheet.
    ["--mnya-navy800" as string]: theme.navy800,
    ["--mnya-navy900" as string]: theme.navy900,
    ["--mnya-accent" as string]: theme.accent,
    ["--mnya-accent-soft" as string]: theme.accentSoft,
    ["--mnya-magenta" as string]: theme.magenta,
    ["--mnya-online" as string]: theme.online,
  };

  return (
    <div className="mnya-root" style={rootStyle}>
      {chatOpen && (
        <div
          className="mnya-window"
          style={{ bottom: chatBottom, width: chatSize.w, height: chatSize.h }}
        >
          <div
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            className="mnya-resize"
            title="Потяните, чтобы изменить размер окна"
          >
            <svg width="14" height="14" style={{ transform: "rotate(90deg)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11 7v4m0 0h-4m4 0l-5-5" />
            </svg>
          </div>

          <div className="mnya-header">
            <div className="mnya-grid" />
            <div className="mnya-avatar">
              <ManyashaAvatar video={cfg.mascotVideo} poster={cfg.mascotPoster} name={cfg.botName} />
            </div>
            <div className="mnya-head-text">
              <p className="mnya-name">{cfg.botName}</p>
              <p className="mnya-status">
                <span className="mnya-dot">
                  <span className="mnya-dot-ping" />
                  <span className="mnya-dot-core" />
                </span>
                {cfg.statusText}
              </p>
            </div>
            <button onClick={() => setChatOpen(false)} className="mnya-close" aria-label="Закрыть чат">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mnya-msgs">
            {messages.length === 0 && (
              <div className="mnya-greet">
                <div className="mnya-greet-avatar">
                  <ManyashaAvatar video={cfg.mascotVideo} poster={cfg.mascotPoster} name={cfg.botName} />
                </div>
                <p className="mnya-greet-title">{cfg.greetingTitle}</p>
                <p className="mnya-greet-sub">{cfg.greetingSubtitle}</p>
                <div className="mnya-quick">
                  {cfg.quickQuestions.map((q) => (
                    <button key={q} onClick={() => handleQuickQuestion(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`mnya-row ${msg.role === "user" ? "mnya-row-user" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="mnya-msg-avatar">
                    <ManyashaAvatar video={cfg.mascotVideo} poster={cfg.mascotPoster} />
                  </div>
                )}
                <div className={`mnya-bubble ${msg.role === "user" ? "mnya-bubble-user" : "mnya-bubble-bot"}`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="mnya-row">
                <div className="mnya-msg-avatar">
                  <ManyashaAvatar video={cfg.mascotVideo} poster={cfg.mascotPoster} />
                </div>
                <div className="mnya-typing">
                  <div className="d">
                    <span style={{ animationDelay: "0ms" }} />
                    <span style={{ animationDelay: "150ms" }} />
                    <span style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="mnya-input-area">
            <div className="mnya-input-row">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите сообщение..."
                disabled={loading}
                className="mnya-input"
              />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="mnya-send" aria-label="Отправить">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            {cfg.telegramUrl && (
              <a href={cfg.telegramUrl} target="_blank" rel="noopener noreferrer" className="mnya-tg">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Продолжить в Telegram
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mnya-mascot" style={{ width: mascotWidth }}>
        <button
          onClick={cycleSize}
          onPointerDown={(e) => e.stopPropagation()}
          className="mnya-size-btn"
          aria-label="Изменить размер маскота"
          title="Изменить размер маскота"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <div className="mnya-glow">
          <div className="mnya-glow-a" />
          <div className="mnya-glow-b" />
        </div>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`mnya-video-wrap ${dragging ? "dragging" : ""}`}
        >
          {/* Большой плавающий маскот — ЖИВОЙ (idle-анимация). Статичны только
              маленькие аватары-иконки внутри чата (см. ManyashaAvatar). */}
          <video
            src={cfg.mascotVideo}
            poster={cfg.mascotPoster}
            loop muted playsInline autoPlay preload="auto"
            draggable={false}
            className="mnya-video"
          />
        </div>

        {!chatOpen && !dragging && (
          <div className="mnya-hint">
            <div className="mnya-hint-box">
              {cfg.hint}
              <div className="mnya-hint-tail" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
