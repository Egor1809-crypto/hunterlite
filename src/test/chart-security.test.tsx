import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartStyle, type ChartConfig } from "@/components/ui/chart";

describe("chart style security", () => {
  it("renders safe chart CSS variables", () => {
    const config = {
      score: { color: "hsl(var(--accent))" },
      trend: { color: "#8b5cf6" },
    } satisfies ChartConfig;

    const { container } = render(<ChartStyle id="chart-safe" config={config} />);
    const styleText = container.querySelector("style")?.textContent || "";

    expect(styleText).toContain("[data-chart=chart-safe]");
    expect(styleText).toContain("--color-score: hsl(var(--accent));");
    expect(styleText).toContain("--color-trend: #8b5cf6;");
  });

  it("skips unsafe CSS variable names and values", () => {
    const config = {
      "score};body{color:red": { color: "hsl(var(--accent))" },
      trend: { color: "red;background:url(javascript:alert(1))" },
      safe: { color: "var(--ai)" },
    } satisfies ChartConfig;

    const { container } = render(<ChartStyle id={'chart-evil"]{color:red}'} config={config} />);
    const styleText = container.querySelector("style")?.textContent || "";

    expect(styleText).toContain("[data-chart=chart-evil---color-red-]");
    expect(styleText).toContain("--color-safe: var(--ai);");
    expect(styleText).not.toContain("javascript:");
    expect(styleText).not.toContain("body{color:red");
    expect(styleText).not.toContain("--color-score};body");
    expect(styleText).not.toContain("background:url");
  });
});
