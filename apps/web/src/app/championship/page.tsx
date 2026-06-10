"use client";

/**
 * /championship — единая точка входа в чемпионат/розыгрыш (решение 2026-06-10).
 *
 * Адаптивный surface:
 *  - ГОСТЬ (и SSR — для SEO самой маркетинговой страницы): лендинг-обёртка с
 *    тонким топ-баром «вход/регистрация» и `<ChampionshipPage surface="landing">`.
 *  - АВТОРИЗОВАН: после монтирования оборачиваем в `<AuthLayout>` (полный chrome
 *    платформы: сайдбар, Маняша через isContest) и `surface="app"`.
 *
 * Standalone route (NOT inside the landing SPA's inner-scroll panel) so the page
 * scrolls the window — Apple-style scroll storytelling needs useScroll on window.
 * Старый платформенный роут /certificate/contest редиректит сюда.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import AuthLayout from "@/components/layout/AuthLayout";
import ChampionshipPage from "@/components/championship/ChampionshipPage";
import ManyashaChat from "@/components/ManyashaChat";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";

const CONTEST_INTRO =
  "Привет! Это страница розыгрыша «Чемпионат сезона». Разыгрываем призы Apple — " +
  "MacBook Air 13 M4, iPhone 15 и AirPods 4. Спросите меня про условия участия, " +
  "сроки сезона или налоги с приза — подскажу.";

/** Маркер-cookie выживает перезагрузку — тем же способом авторизацию определяет AuthLayout. */
function hasAuthMarkerCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("vh_authenticated=");
}

export default function ChampionshipRoute() {
  // SSR/первый рендер = гость (лендинг-surface для SEO). После монтирования,
  // если есть маркер авторизации — переключаемся на платформенный chrome.
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(hasAuthMarkerCookie());
  }, []);

  if (authed) {
    // Платформенный surface — Маняша приходит из AuthLayout (isContest).
    return (
      <AuthLayout showBreadcrumbs={false}>
        <div className="relative min-h-screen overflow-hidden bg-page-glow">
          <AbstractBackdrop />
          <div className="relative z-10">
            <div className="mx-auto max-w-[1100px] px-6 pt-6 sm:px-10">
              <Link
                href="/certificate"
                className="group inline-flex items-center gap-2 font-mono uppercase transition-colors"
                style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
              >
                <ArrowLeft size={14} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
                К сертификату
              </Link>
            </div>
            <ChampionshipPage surface="app" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Гостевой / SSR surface — лендинг.
  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <AbstractBackdrop />

      {/* Тонкий топ-бар: бренд + вход/регистрация */}
      <header className="relative z-20 mx-auto flex max-w-[1100px] items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="text-xl font-extrabold tracking-tight no-underline" style={{ color: "var(--text-primary)" }}>
          Legal<span style={{ color: "var(--brand-logo-hunter, var(--primary))" }}>Hunter</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium no-underline" style={{ color: "var(--text-secondary)" }}>
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-full px-4 py-2 text-sm font-semibold no-underline"
            style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
          >
            Начать
          </Link>
        </div>
      </header>

      <div className="relative z-10">
        <ChampionshipPage surface="landing" />
      </div>

      <ManyashaChat config={{ apiEndpoint: "/api/chat" }} autoOpen autoOpenMessage={CONTEST_INTRO} forceShow />
    </div>
  );
}
