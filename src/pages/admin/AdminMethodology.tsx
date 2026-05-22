import { Link } from "react-router-dom";
import { BookOpen, FileText, Link2, ShieldCheck } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bflMethodologyChapters, methodologyStats } from "@/lib/methodology";

const statusVariant = (status: string) => status === "Риск" ? "warning" : status === "Важно" ? "info" : "success";

export default function AdminMethodology() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к системе" fallback="/admin" />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={BookOpen} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Методология</div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight mt-1">Книга БФЛ и учебные материалы</h1>
            <p className="text-muted-foreground mt-1">
              Управление темами, актуальностью и связью материалов с тренировками сотрудников.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="bg-card">
          <Link to="/bfl-book"><BookOpen className="h-4 w-4 mr-1.5" /> Открыть книгу</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Глав", value: methodologyStats.chapters, icon: FileText },
          { label: "Тем", value: methodologyStats.topics, icon: BookOpen },
          { label: "Связанных блоков", value: methodologyStats.linkedTrainingBlocks, icon: Link2 },
          { label: "Проходной балл", value: "88", icon: ShieldCheck },
        ].map((item) => (
          <Card key={item.label} className="p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{item.label}</span>
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-pixel-number text-3xl mt-2">{item.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5 shadow-card">
        <h2 className="font-display font-bold text-primary mb-4">Матрица методологии</h2>
        <div className="space-y-3">
          {bflMethodologyChapters.map((chapter) => (
            <div key={chapter.id} className="grid lg:grid-cols-[1fr_1fr_auto] gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-bold text-primary">{chapter.title}</h3>
                  <StatusBadge variant={statusVariant(chapter.status)}>{chapter.status}</StatusBadge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Ответственный: {chapter.owner} · обновлено {chapter.updatedAt}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chapter.trainingLinks.map((link) => (
                    <StatusBadge key={link} variant="info">{link}</StatusBadge>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {chapter.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" className="bg-background lg:self-center">
                <Link to="/admin/tests">Связать тесты</Link>
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
