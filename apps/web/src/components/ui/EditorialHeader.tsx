"use client";

import type { ReactNode } from "react";

export interface EditorialHeaderProps {
  /** левый mono-эйбров, напр. «Практикум · банкротство физлиц» */
  eyebrowLeft?: string;
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
  title,
  subtitle,
  subtitleNoWrap = false,
  right,
  className = "",
}: EditorialHeaderProps) {
  return (
    <div className={className}>

      <div className="flex flex-wrap items-start justify-between gap-5">
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
              style={{ fontSize: 17, lineHeight: 1.55, color: "var(--text-secondary)", maxWidth: subtitleNoWrap ? undefined : 600, textWrap: "pretty" }}
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
