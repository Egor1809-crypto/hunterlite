"use client";

/**
 * EditorialHeader — единый «редакторский» заголовок страницы для всей платформы.
 *
 * Канон взят со страницы /cases (которую любим) и из референсов malvah.co /
 * abstract.com: иерархия МАСШТАБОМ, не весом и не цветом.
 *
 *   [ЭЙБРОВ-СЛЕВА · код]                         [ЭЙБРОВ-СПРАВА]   ← mono uppercase
 *   Заголовок                                                     ← крупный display
 *   подзаголовок одной спокойной строкой…                         ← узкая колонка
 *
 * Принципиально: НЕТ декоративной иконки-плашки в шапке — именно она «выдаёт
 * ИИшность» и ломает редакторский вид. Идентичность даёт типографика + воздух +
 * один акцент. Тема — на токенах (свет/тьма).
 */

import type { ReactNode } from "react";

export interface EditorialHeaderProps {
  /** левый mono-эйбров, напр. «Практикум · банкротство физлиц» */
  eyebrowLeft: string;
  /** правый mono-эйбров, напр. «ФЗ-127» (выравнивается к правому краю) */
  eyebrowRight?: string;
  title: string;
  subtitle?: string;
  /** не переносить подзаголовок — держать в одну строку (снимает ограничение maxWidth) */
  subtitleNoWrap?: boolean;
  /** опциональный слот действия/индикатора справа от заголовка (кнопка и т.п.) */
  right?: ReactNode;
  className?: string;
}

export function EditorialHeader({
  eyebrowLeft,
  eyebrowRight,
  title,
  subtitle,
  subtitleNoWrap = false,
  right,
  className = "",
}: EditorialHeaderProps) {
  return (
    <div className={className}>
      {/* Эйбров-пара по краям — тихие классификаторы */}
      <div className="flex items-center justify-between gap-4">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-secondary)" }}
        >
          {eyebrowLeft}
        </span>
        {eyebrowRight && (
          <span
            className="font-mono uppercase tabular-nums"
            style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
          >
            {eyebrowRight}
          </span>
        )}
      </div>

      {/* Заголовок + опциональное действие */}
      <div className="mt-5 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(40px, 7vw, 80px)",
              lineHeight: 0.95,
              letterSpacing: "-0.045em",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-5"
              style={{ fontSize: 17, lineHeight: 1.55, color: "var(--text-secondary)", maxWidth: subtitleNoWrap ? undefined : 600, whiteSpace: subtitleNoWrap ? "nowrap" : undefined }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
