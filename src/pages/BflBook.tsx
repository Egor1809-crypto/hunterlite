import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconBadge } from "@/components/IconBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { bflMethodologyChapters, methodologyStats } from "@/lib/methodology";
import { BookOpen, Bookmark, FileText, Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function Book3D() {
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className="relative group cursor-pointer"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative transition-transform duration-700 ease-out group-hover:[transform:rotateY(-25deg)]"
          style={{
            transformStyle: "preserve-3d",
            width: "220px",
            height: "300px",
          }}
        >
          <div
            className="absolute inset-0 rounded-r-lg rounded-l-sm shadow-2xl flex flex-col items-center justify-center overflow-hidden"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              background: "linear-gradient(135deg, hsl(222 47% 16%), hsl(222 47% 24%), hsl(217 91% 25%))",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217_91%_60%/0.2),transparent_60%)]" />
            <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-white/20 via-white/5 to-white/20" />
            <div className="relative flex flex-col items-center gap-4 px-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">HUNTERLITE</div>
                <div className="font-display text-xl font-bold text-white mt-1 leading-tight">
                  Банкротство<br />физических лиц
                </div>
              </div>
              <div className="w-12 h-px bg-white/20" />
              <div className="text-[11px] text-white/50">Краткий справочник</div>
            </div>
            <div className="absolute bottom-4 text-[10px] text-white/30 tracking-wider">2026</div>
          </div>

          <div
            className="absolute top-0 h-full rounded-l-sm"
            style={{
              width: "30px",
              left: "0",
              transform: "rotateY(-90deg) translateX(-15px)",
              transformOrigin: "left center",
              background: "linear-gradient(to right, hsl(222 47% 14%), hsl(222 47% 18%))",
              boxShadow: "inset -2px 0 4px rgba(0,0,0,0.3)",
            }}
          >
            <div className="h-full flex items-center justify-center">
              <span
                className="text-[9px] font-bold text-white/40 uppercase tracking-[0.15em] whitespace-nowrap"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                БФЛ Справочник
              </span>
            </div>
          </div>

          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute top-[2px] rounded-r-sm"
              style={{
                width: "216px",
                height: "296px",
                right: `${i}px`,
                background: `hsl(40 30% ${94 - i}%)`,
                transform: `translateZ(-${i * 1.5}px)`,
                boxShadow: i === 4 ? "2px 0 8px rgba(0,0,0,0.15)" : "none",
              }}
            />
          ))}

          <div
            className="absolute inset-0 rounded-r-lg rounded-l-sm"
            style={{
              transform: "translateZ(-8px)",
              background: "linear-gradient(135deg, hsl(222 47% 14%), hsl(222 47% 20%))",
              boxShadow: "4px 4px 16px rgba(0,0,0,0.3)",
            }}
          />
        </div>

        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[180px] h-[20px] bg-black/20 rounded-full blur-xl transition-all duration-700 group-hover:w-[200px] group-hover:translate-x-[-60%]"
        />
      </div>
    </div>
  );
}

export default function BflBook() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredChapters = bflMethodologyChapters.filter((chapter) =>
    chapter.title.toLowerCase().includes(search.toLowerCase()) ||
    chapter.items.some((item) => item.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={BookOpen} />
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Книга БФЛ</h1>
            <p className="text-muted-foreground mt-1">
              База знаний по банкротству физических лиц для консультаций и подготовки к тренировкам.
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по книге..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <Card className="p-5 shadow-card">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-5 items-center">
          <Book3D />
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Текущий фокус</div>
            <h2 className="font-display text-2xl font-bold text-primary mt-2">Банкротство физических лиц: краткий справочник</h2>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Здесь будет храниться внутренняя книга: юридические основы, типовые вопросы клиентов,
              безопасные формулировки и разбор рисковых ситуаций.
            </p>
            <div className="grid gap-2 mt-4">
              {[
                { label: "Глав", value: methodologyStats.chapters },
                { label: "Тем для консультаций", value: methodologyStats.topics },
                { label: "Статус", value: "Черновик" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="font-semibold text-primary">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {filteredChapters.length === 0 && (
        <Card className="p-8 shadow-card text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground mt-3">Ничего не найдено по запросу "{search}"</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {filteredChapters.map((chapter) => {
          const isExpanded = expandedId === chapter.id;

          return (
            <Card key={chapter.id} className="p-5 shadow-card">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggle(chapter.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-accent shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-accent shrink-0" />
                    )}
                    <h3 className="font-display font-bold text-primary">{chapter.title}</h3>
                  </div>
                  <StatusBadge variant={chapter.status === "Риск" ? "warning" : "info"}>{chapter.status}</StatusBadge>
                </div>
              </button>
              <div className={cn("mt-4 space-y-2", !isExpanded && "hidden")}>
                {chapter.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>{item}</span>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground italic">Материал в разработке</p>
                </div>
              </div>
              {!isExpanded && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {chapter.items.length} тем
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
