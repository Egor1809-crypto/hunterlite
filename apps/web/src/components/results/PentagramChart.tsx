"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import { cssVar } from "@/lib/chartTheme";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

interface PentagramData {
  labels: string[];
  values: number[];
  previousValues?: number[];
}

function useIsDark() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function PentagramChart({ data }: { data: PentagramData }) {
  const isDark = useIsDark();

  const gridColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const labelColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)";
  const tickColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.5)";
  const tooltipBg = isDark ? "rgba(10,10,15,0.95)" : "rgba(255,255,255,0.98)";
  const tooltipText = isDark ? "#fff" : "#1a1a1a";
  const pointBorder = isDark ? "#0a0a0f" : "#ffffff";
  const accentHex = cssVar("--accent", "#6B4DC7");
  // 2026-06-06: красивый шрифт — основной Geist Sans приложения (был Rajdhani).
  const sansFont =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() ||
        "system-ui, sans-serif"
      : "system-ui, sans-serif";

  // Перенос длинных подписей на несколько строк, чтобы они не обрезались
  // у краёв карточки (раньше «…ческие нарушения», «Правовая точн…» резались).
  const wrapLabel = (label: string | number): string | string[] => {
    const words = String(label).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 15 && cur) {
        lines.push(cur.trim());
        cur = w;
      } else {
        cur = (cur + " " + w).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines.length > 1 ? lines : lines[0] ?? "";
  };

  // Guard: ensure labels and values arrays are the same length.
  const safeLabels = data.labels;
  const safeValues =
    data.values.length === safeLabels.length
      ? data.values
      : [...data.values, ...Array(Math.max(0, safeLabels.length - data.values.length)).fill(0)].slice(0, safeLabels.length);

  // Empty-state check: all values are 0 or missing → show friendly placeholder
  // instead of a collapsed polygon that looks broken.
  const hasRealData = safeValues.some((v) => v > 0);
  if (!hasRealData) {
    return (
      <div
        className="relative w-full flex flex-col items-center justify-center text-center"
        style={{ minHeight: 340, color: labelColor }}
      >
        <div
          className="font-display text-base mb-2"
          style={{ color: labelColor }}
        >
          Недостаточно данных
        </div>
        <div className="text-sm" style={{ color: tickColor, maxWidth: 360 }}>
          Навыки рассчитываются по итогам тренировок.
          Проведите полную сессию, чтобы увидеть разбивку.
        </div>
      </div>
    );
  }

  const datasets = [
    {
      label: "Текущая сессия",
      data: safeValues,
      backgroundColor: "rgba(107, 77, 199, 0.35)",
      borderColor: accentHex,
      pointBackgroundColor: accentHex,
      pointBorderColor: pointBorder,
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: pointBorder,
      pointHoverBorderColor: accentHex,
      borderWidth: 2.5,
      fill: true,
    },
  ];

  if (data.previousValues?.length === safeLabels.length && data.previousValues.some((v) => v > 0)) {
    datasets.push({
      label: "Предыдущая",
      data: data.previousValues,
      backgroundColor: "rgba(138, 43, 226, 0.08)",
      borderColor: "rgba(138, 43, 226, 0.4)",
      pointBackgroundColor: "transparent",
      pointBorderColor: "transparent",
      pointBorderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHoverBackgroundColor: "transparent",
      pointHoverBorderColor: "transparent",
      borderWidth: 1.5,
      fill: false,
    });
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // 2026-06-06: внутренние отступы, чтобы перенесённые подписи помещались
    // целиком и не упирались в края карточки.
    layout: { padding: { top: 8, bottom: 8, left: 28, right: 28 } },
    scales: {
      r: {
        angleLines: { color: gridColor, lineWidth: 1 },
        grid: { color: gridColor, circular: true, lineWidth: 1 },
        pointLabels: {
          font: {
            family: sansFont,
            size: 11.5,
            weight: 600 as const,
            lineHeight: 1.15,
          },
          color: labelColor,
          padding: 12,
          callback: wrapLabel,
        },
        ticks: {
          display: true,
          stepSize: 25,
          color: tickColor,
          backdropColor: "transparent",
          font: { size: 9 },
          showLabelBackdrop: false,
        },
        min: 0,
        max: 100,
      },
    },
    plugins: {
      legend: {
        display: (data.previousValues?.length ?? 0) > 0,
        position: "bottom" as const,
        labels: { color: labelColor, font: { size: 11 }, padding: 12 },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: accentHex,
        borderWidth: 1,
        padding: 10,
        titleFont: { family: sansFont, size: 13, weight: 600 as const },
        bodyFont: { family: sansFont, size: 12 },
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { r: number } }) =>
            `${ctx.dataset.label}: ${Math.round(ctx.parsed.r)}%`,
        },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ minHeight: 380 }}>
      <Radar data={{ labels: safeLabels, datasets }} options={options} />
    </div>
  );
}
