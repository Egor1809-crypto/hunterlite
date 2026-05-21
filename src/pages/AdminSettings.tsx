import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { Save, Settings } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к системе" fallback="/admin" />

      <div className="flex items-start gap-4">
        <IconBadge icon={Settings} />
        <div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Настройки</h1>
          <p className="text-muted-foreground mt-1">Параметры аттестации и юридических предупреждений.</p>
        </div>
      </div>

      <Card className="p-5 shadow-card space-y-4">
        <h3 className="font-display font-bold text-primary">Экзамен</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Проходной балл, %</Label>
            <Input type="number" defaultValue={88} />
          </div>
          <div>
            <Label>Длительность, мин</Label>
            <Input type="number" defaultValue={30} />
          </div>
          <div>
            <Label>Количество вопросов</Label>
            <Input type="number" defaultValue={10} />
          </div>
          <div>
            <Label>Период переаттестации, мес</Label>
            <Input type="number" defaultValue={6} />
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-card space-y-4">
        <h3 className="font-display font-bold text-primary">Темы курса</h3>
        <div className="space-y-2">
          {["Условия банкротства", "Последствия банкротства", "Имущество должника", "Сроки процедуры", "Стоимость и риски"].map((t) => (
            <div key={t} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-sm">{t}</span>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 shadow-card space-y-3">
        <h3 className="font-display font-bold text-primary">Юридические предупреждения</h3>
        {[
          "Блокировать ответы с гарантией списания всех долгов",
          "Подсвечивать запугивание клиента",
          "Требовать оговорку «зависит от ситуации»",
          "Аудио не сохраняется (только расшифровка)",
        ].map((p) => (
          <div key={p} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">{p}</span>
            <Switch defaultChecked />
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90"><Save className="h-4 w-4 mr-1.5" /> Сохранить настройки</Button>
      </div>
    </div>
  );
}
