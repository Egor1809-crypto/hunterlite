import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/IconBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { BookOpen, Bookmark, FileText, Search } from "lucide-react";

const chapters = [
  {
    title: "Основания для банкротства",
    status: "База",
    items: ["Признаки неплатежеспособности", "Сумма и структура долга", "Когда процедура не подходит"],
  },
  {
    title: "Имущество должника",
    status: "Важно",
    items: ["Единственное жильё", "Ипотека и залог", "Автомобиль, счета и сделки"],
  },
  {
    title: "Долги, которые не списываются",
    status: "Риск",
    items: ["Алименты", "Вред жизни и здоровью", "Субсидиарная ответственность"],
  },
  {
    title: "Последствия процедуры",
    status: "Практика",
    items: ["Кредитная история", "Ограничения после завершения", "Повторное банкротство"],
  },
];

export default function BflBook() {
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
        <Button variant="outline" className="bg-card">
          <Search className="h-4 w-4 mr-1.5" /> Поиск по книге
        </Button>
      </div>

      <Card className="p-5 shadow-card">
        <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-5">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Текущий фокус</div>
            <h2 className="font-display text-2xl font-bold text-primary mt-2">Банкротство физических лиц: краткий справочник</h2>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Здесь будет храниться внутренняя книга: юридические основы, типовые вопросы клиентов,
              безопасные формулировки и разбор рисковых ситуаций.
            </p>
          </div>
          <div className="grid gap-2">
            {[
              { label: "Глав", value: chapters.length },
              { label: "Тем для консультаций", value: chapters.reduce((sum, chapter) => sum + chapter.items.length, 0) },
              { label: "Статус", value: "Черновик" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="font-semibold text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {chapters.map((chapter) => (
          <Card key={chapter.title} className="p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                <h3 className="font-display font-bold text-primary">{chapter.title}</h3>
              </div>
              <StatusBadge variant={chapter.status === "Риск" ? "warning" : "info"}>{chapter.status}</StatusBadge>
            </div>
            <div className="mt-4 space-y-2">
              {chapter.items.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
