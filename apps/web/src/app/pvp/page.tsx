"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Sword, Trophy, Lightning, Target, Sparkle, Briefcase } from "@phosphor-icons/react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePvPStore } from "@/stores/usePvPStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { RatingCard } from "@/components/pvp/RatingCard";
import { MatchmakingOverlay } from "@/components/pvp/MatchmakingOverlay";
import { logger } from "@/lib/logger";
// PixelIcon removed — clean design system
import { CharacterPicker } from "@/components/pvp/CharacterPicker";
// KnowledgeBaseBrowser moved to standalone /knowledge page
import { HonestNavigator } from "@/components/pvp/HonestNavigator";
import { TopPlayersPanel } from "@/components/pvp/TopPlayersPanel";
import { ArenaLivePanel } from "@/components/pvp/ArenaLivePanel";
import { HistoryPanel } from "@/components/pvp/HistoryPanel";
import { LobbyMascot } from "@/components/pvp/LobbyMascot";

function PvPLobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = usePvPStore();
  const tabParam = searchParams.get("tab");
  // PR-19: 3 tabs — combat (бой), knowledge_base (изучать), history (история).
  // «combat» — default; legacy ?tab=knowledge_base|rag → knowledge_base.
  type LobbyTab = "combat" | "history" | "cases";
  const initialTab: LobbyTab =
    tabParam === "history" ? "history"
    : tabParam === "cases" ? "cases"
    : "combat";
  const [tab, setTab] = useState<LobbyTab>(initialTab);
  // Reactively flip tab when ?tab= changes.
  useEffect(() => {
    if (tabParam === "history") setTab("history");
    else if (tabParam === "cases") setTab("cases");
    else if (tabParam === null) setTab("combat");
  }, [tabParam]);
  const [quizStarting, setQuizStarting] = useState(false);
  const [pickedCharacterId, setPickedCharacterId] = useState<string | null>(null);
  const [arenaPoints, setArenaPoints] = useState<number>(0);
  const inviteSentRef = useRef(false);
  const autoPvERef = useRef(false);
  const searchStartedAtRef = useRef<number | null>(null);

  const fetchArenaPoints = useCallback(() => {
    api.get("/progression/arena-points")
      .then((data: Record<string, unknown>) => {
        if (typeof data?.arena_points === "number") setArenaPoints(data.arena_points);
      })
      .catch((err) => logger.error("[pvp] arena-points fetch failed:", err));
  }, []);

  useEffect(() => {
    store.fetchRating();
    store.fetchMyDuels();
    store.fetchActiveSeason();
    fetchArenaPoints();
  }, [fetchArenaPoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refetch rating + duels + AP when the tab becomes visible again
  // (e.g. user returned from /pvp/duel/[id] or /pvp/quiz/*). Без этого
  // «Калибровка 0/10» зависала до ручного reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      store.fetchRating();
      store.fetchMyDuels();
      fetchArenaPoints();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchArenaPoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // PvP WebSocket
  const { sendMessage, connectionState } = useWebSocket({
    path: "/ws/pvp",
    autoConnect: true,
    onMessage: (data) => {
      switch (data.type) {
        case "queue.joined":
          autoPvERef.current = false;
          searchStartedAtRef.current = Date.now();
          store.setQueueStatus("searching");
          if (typeof data.data.position === "number") {
            store.setQueuePosition(data.data.position as number, store.estimatedWait);
          }
          break;
        case "queue.status":
          store.setQueuePosition(
            (data.data.queue_size as number) ?? (data.data.position as number) ?? 0,
            data.data.estimated_remaining as number,
          );
          break;
        case "match.found":
          autoPvERef.current = false;
          searchStartedAtRef.current = null;
          store.setQueueStatus("matched");
          store.setMatchedOpponentRating(
            typeof data.data.opponent_rating === "number" ? (data.data.opponent_rating as number) : null,
          );
          // Navigate to duel page
          setTimeout(() => {
            router.push(`/pvp/duel/${data.data.duel_id}`);
          }, 2000);
          break;
        case "pve.offer":
          // Backend emits pve.offer on PvE match — FE just marks "matched";
          // duel.brief / match.found arrive next and redirect to the duel.
          store.setQueueStatus("matched");
          break;
        case "queue.left":
          autoPvERef.current = false;
          searchStartedAtRef.current = null;
          store.resetQueue();
          break;
      }
    },
  });

  const handleFindMatch = useCallback(() => {
    autoPvERef.current = false;
    searchStartedAtRef.current = Date.now();
    store.setQueueStatus("searching");
    const payload: Record<string, unknown> = { type: "queue.join" };
    if (pickedCharacterId) payload.character_id = pickedCharacterId;
    sendMessage(payload);
  }, [sendMessage, store, pickedCharacterId]);

  const startQuiz = useCallback(async (
    mode: "free_dialog" | "blitz" | "themed",
    category?: string,
  ) => {
    setQuizStarting(true);
    const watchdog = setTimeout(() => {
      setQuizStarting(false);
      useNotificationStore.getState().addToast({
        title: "Таймаут",
        body: "Сервер долго отвечает. Попробуйте ещё раз.",
        type: "warning",
      });
    }, 10_000);
    const personality = mode === "blitz" ? "showman" : "professor";
    try {
      const res = await api.post("/knowledge/sessions", {
        mode,
        category: category ?? null,
        ai_personality: personality,
        choices_format: true,
      }) as { id?: string; session_id?: string };
      clearTimeout(watchdog);
      const sid = res?.id || res?.session_id;
      if (sid) {
        const params = new URLSearchParams({ mode });
        if (category) params.set("category", category);
        params.set("personality", personality);
        params.set("choices_format", "1");
        router.push(`/pvp/quiz/${sid}?${params.toString()}`);
      } else {
        useNotificationStore.getState().addToast({
          title: "Ошибка",
          body: "Не удалось создать сессию. Попробуйте ещё раз.",
          type: "error",
        });
      }
    } catch (e) {
      clearTimeout(watchdog);
      logger.error("Failed to start quiz:", e);
      useNotificationStore.getState().addToast({
        title: "Ошибка",
        body: "Не удалось начать тест. Проверьте подключение.",
        type: "error",
      });
    } finally {
      clearTimeout(watchdog);
      setQuizStarting(false);
    }
  }, [router]);

  const handleCancelQueue = useCallback(() => {
    autoPvERef.current = false;
    searchStartedAtRef.current = null;
    sendMessage({ type: "queue.leave" });
    store.resetQueue();
  }, [sendMessage, store]);

  // Auto-accept PvP invitation when arriving with ?accept=challenger_id
  const acceptParam = searchParams.get("accept");
  useEffect(() => {
    if (!acceptParam || inviteSentRef.current || connectionState !== "connected") return;
    inviteSentRef.current = true;
    autoPvERef.current = false;
    searchStartedAtRef.current = Date.now();
    store.setQueueStatus("searching");
    sendMessage({ type: "queue.join", invitation_challenger_id: acceptParam });
    router.replace("/pvp", { scroll: false });
  }, [acceptParam, connectionState, sendMessage, router, store]);

  useEffect(() => {
    if (store.queueStatus !== "searching") return;
    const startedAt = searchStartedAtRef.current;
    if (!startedAt || Date.now() - startedAt < 58_000) return;
    if (store.estimatedWait > 0) return;
    if (autoPvERef.current) return;

    autoPvERef.current = true;

    const controller = new AbortController();
    api.post("/pvp/accept-pve", {}, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const duelId = (data as { duel_id?: string })?.duel_id;
        if (!duelId) {
          // No PvE opponent found — reset queue + toast (без этого
          // пользователь зависал с overlay «Ищем соперника…» навсегда).
          autoPvERef.current = false;
          store.resetQueue();
          useNotificationStore.getState().addToast({
            title: "Соперник не найден",
            body: "Попробуйте ещё раз через минуту.",
            type: "warning",
          });
          return;
        }
        store.resetQueue();
        store.setQueueStatus("matched");
        router.push(`/pvp/duel/${duelId}`);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        logger.error("Auto PvE match failed:", err);
        autoPvERef.current = false;
        useNotificationStore.getState().addToast({
          title: "Ошибка подбора",
          body: "Не удалось найти PvE-соперника. Попробуйте позже.",
          type: "error",
        });
      });

    return () => controller.abort();
  }, [store.queueStatus, store.estimatedWait, router, store]);

  return (
    <AuthLayout>
      <motion.div
        className="relative arena-grid-bg min-h-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="app-page pb-36 md:pb-44">
          {/* Connection status banner — smooth slide-in */}
          <AnimatePresence>
            {connectionState !== "connected" && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    background: connectionState === "error" ? "var(--danger-muted)" : "var(--warning-muted)",
                    color: connectionState === "error" ? "var(--danger)" : "var(--warning)",
                    border: `1px solid ${connectionState === "error" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  {connectionState === "error"
                    ? "ОШИБКА ПОДКЛЮЧЕНИЯ К PVP СЕРВЕРУ"
                    : connectionState === "reconnecting"
                      ? "ПЕРЕПОДКЛЮЧЕНИЕ..."
                      : "ПОДКЛЮЧЕНИЕ К PVP..."}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Header */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(248, 113, 113, 0.12)",
                    boxShadow: "0 0 0 1px rgba(248, 113, 113, 0.2)",
                  }}
                >
                  <Sword size={22} weight="duotone" style={{ color: "#F87171" }} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    PVP Арена
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Дуэли 1 на 1 · Glicko-2 рейтинг
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* PR-16: «Персонаж» переехал из collapsible под центром
                    в иконку рядом с info button. Открывается popover'ом
                    через нативный <details>; на mobile collapsible
                    остаётся как fallback (см. main column). */}
                <details className="hidden lg:block relative group">
                  <summary
                    className="cursor-pointer select-none list-none inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                    style={{
                      background: pickedCharacterId
                        ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                        : "var(--bg-panel)",
                      color: pickedCharacterId ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${pickedCharacterId ? "var(--accent)" : "var(--border-color)"}`,
                    }}
                    title={pickedCharacterId ? "Персонаж выбран" : "Выбрать кастомного клиента"}
                    aria-label="Персонаж"
                  >
                    <Target size={18} />
                  </summary>
                  <div
                    className="absolute right-0 top-full mt-2 z-30 w-[320px] p-3 rounded-xl"
                    style={{
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border-color)",
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    <CharacterPicker
                      selectedId={pickedCharacterId}
                      onPick={setPickedCharacterId}
                      disabled={store.queueStatus !== "idle"}
                    />
                  </div>
                </details>
                {/* Info button removed */}
              </div>
            </div>
          </motion.div>

          {/* Season banner */}
          {store.activeSeason && (() => {
            const s = store.activeSeason;
            const end = new Date(s.end_date);
            const now = Date.now();
            const msLeft = end.getTime() - now;
            const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
            const top1 = (s.top_rewards ?? []).find((t) => t.rank === 1);
            const endLabel = end.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mt-4 p-3 flex items-center flex-wrap gap-x-4 gap-y-2 rounded-xl"
                style={{
                  background: "color-mix(in srgb, var(--gf-xp) 10%, var(--bg-panel))",
                  border: "1px solid color-mix(in srgb, var(--gf-xp) 30%, transparent)",
                }}
              >
                <span className="flex items-center gap-2">
                  <Lightning weight="duotone" size={16} style={{ color: "var(--gf-xp)" }} />
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--gf-xp)" }}
                  >
                    {s.name}
                  </span>
                </span>
                {msLeft > 0 && (
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    · до {endLabel} ({daysLeft} {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"})
                  </span>
                )}
                {top1 && (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--gf-xp)" }}
                  >
                    · топ-1 = {top1.ap} AP
                  </span>
                )}
              </motion.div>
            );
          })()}

          {/* Rating loading state */}
          {store.ratingLoading && (
            <div className="mt-6 flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          )}

          {/* Rating failed */}
          {!store.rating && !store.ratingLoading && (
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                Не удалось загрузить рейтинг. Проверьте подключение к серверу.
              </p>
              <motion.button
                onClick={() => store.fetchRating()}
                whileTap={{ scale: 0.97 }}
                className="btn-neon text-sm font-medium"
              >
                Повторить
              </motion.button>
            </div>
          )}

          {/* Rating card */}
          {store.rating && !store.ratingLoading && (
            <div className="mt-6">
              <RatingCard rating={store.rating} />

              {/* Arena Points chip */}
              <div
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  background: "color-mix(in srgb, var(--gf-xp) 12%, var(--bg-panel))",
                  border: "1px solid color-mix(in srgb, var(--gf-xp) 30%, transparent)",
                }}
              >
                <Lightning weight="duotone" size={16} style={{ color: "var(--gf-xp)" }} />
                <span
                  className="font-display font-bold text-lg tabular-nums"
                  style={{ color: "var(--gf-xp)", lineHeight: 1 }}
                >
                  {arenaPoints}
                </span>
                <span
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Arena Points
                </span>
              </div>
            </div>
          )}

          {/* PR-17 (2026-05-08): «Командный центр» layout.
              Левый сайдбар убран, KB-панель из правого сайдбара ушла —
              КБ теперь второй таб центра, симметричный «Бой».
                CENTER (1fr) — tab-bar [🎯 Бой | 📚 Изучать] + content
                RIGHT (240/280px sticky) — Top-3 + ArenaLive + История
              `?tab=knowledge_base` deep-link продолжает работать. */}
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_240px] xl:grid-cols-[1fr_280px] lg:items-start">
            {/* CENTER — tab-bar + active panel */}
            <div className="order-1 flex flex-col gap-4 min-w-0">
              <div
                className="flex items-stretch gap-1 p-1 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                }}
                role="tablist"
                aria-label="Режим арены"
              >
                {([
                  { id: "combat" as const,  label: "Бой",     accent: "var(--accent)" },
                  { id: "cases" as const,   label: "Кейсы",   accent: "var(--magenta, #d946ef)" },
                  { id: "history" as const, label: "История", accent: "var(--gf-xp, #facc15)" },
                ]).map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setTab(t.id);
                        if (t.id === "combat") router.replace("/pvp", { scroll: false });
                        else router.replace(`/pvp?tab=${t.id}`, { scroll: false });
                      }}
                      className="flex-1 text-sm font-semibold py-2.5 rounded-lg transition-colors"
                      style={{
                        background: active
                          ? `color-mix(in srgb, ${t.accent} 18%, transparent)`
                          : "transparent",
                        color: active ? t.accent : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {tab === "combat" && (
                  <motion.div
                    key="combat-tab"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-4"
                  >
                    <HonestNavigator
                      disabled={store.queueStatus !== "idle" || quizStarting}
                      starting={quizStarting}
                      onDuel={handleFindMatch}
                      onQuiz={(mode, category) => startQuiz(mode, category)}
                    />

                    {/* Mobile-only character picker (на lg+ ⚙️ в header). */}
                    <details className="group lg:hidden">
                      <summary
                        className="cursor-pointer select-none inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg"
                        style={{
                          color: "var(--text-muted)",
                          background: "transparent",
                          border: "1px dashed var(--border-color)",
                        }}
                      >
                        <Target size={12} />
                        Персонаж
                        {pickedCharacterId && (
                          <span style={{ color: "var(--accent)", fontSize: 9 }}>● выбран</span>
                        )}
                      </summary>
                      <div className="mt-3">
                        <CharacterPicker
                          selectedId={pickedCharacterId}
                          onPick={setPickedCharacterId}
                          disabled={store.queueStatus !== "idle"}
                        />
                      </div>
                    </details>
                  </motion.div>
                )}
                {tab === "cases" && (
                  <motion.div
                    key="cases-tab"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div
                      className="lh-card flex flex-col items-center justify-center py-16 text-center rounded-xl"
                      style={{
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <Briefcase size={40} weight="duotone" style={{ color: "var(--text-muted)" }} />
                      <h3
                        className="mt-4 font-display text-lg font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Кейсы — скоро
                      </h3>
                      <p className="mt-2 text-sm max-w-sm" style={{ color: "var(--text-muted)" }}>
                        Разбор реальных ситуаций с клиентами. Раздел появится в ближайшем обновлении.
                      </p>
                    </div>
                  </motion.div>
                )}
                {tab === "history" && (
                  <motion.div
                    key="history-tab"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <HistoryPanel />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT sticky sidebar — «Сейчас». История уехала в таб,
                здесь только живые виджеты Top-3 + ArenaLive. */}
            <aside className="order-2 flex flex-col gap-4 min-w-0 lg:sticky lg:top-4 lg:self-start">
              <TopPlayersPanel />
              <ArenaLivePanel />
            </aside>
          </div>
        </div>
      </motion.div>

      {/* Matchmaking overlay */}
      <AnimatePresence>
        {(store.queueStatus === "searching" || store.queueStatus === "matched") && (
          <MatchmakingOverlay
            status={store.queueStatus}
            position={store.queuePosition}
            estimatedWait={store.estimatedWait}
            opponentRating={store.matchedOpponentRating ?? undefined}
            onCancel={handleCancelQueue}
          />
        )}
      </AnimatePresence>

      {/* PR-10 (2026-05-07): LobbyMascot animates between DOM-anchors
          (mode-tile hover, fixed-corner home) via Framer Motion. The
          state is forced when the queue is active so cheer/walk wins
          over the auto-hover idle/walk derivation. */}
      <LobbyMascot
        forcedState={
          store.queueStatus === "matched"
            ? "cheer"
            : store.queueStatus === "searching"
              ? "walk"
              : tab === "cases"
                ? "think"  // лев «думает» на табе Кейсы
                : tab === "history"
                  ? "wink"  // лев подмигивает на табе История
                  : undefined  // combat tab → auto-derive from anchor target
        }
      />

    </AuthLayout>
  );
}

export default function PvPLobbyPage() {
  return (
    <Suspense fallback={
      <AuthLayout>
        <div className="arena-grid-bg min-h-screen flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AuthLayout>
    }>
      <PvPLobbyContent />
    </Suspense>
  );
}
