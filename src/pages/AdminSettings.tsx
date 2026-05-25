import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { Save, Settings } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "hunterlite_admin_settings";

type AdminSettingsData = {
  passingScore: number;
  duration: number;
  questionCount: number;
  recertPeriod: number;
  topics: Record<string, boolean>;
  legalWarnings: Record<string, boolean>;
};

const defaultTopics = [
  "Условия банкротства",
  "Последствия банкротства",
  "Имущество должника",
  "Сроки процедуры",
  "Стоимость и риски",
];

const defaultWarnings = [
  "Блокировать ответы с гарантией списания всех долгов",
  "Подсвечивать запугивание клиента",
  "Требовать оговорку «зависит от ситуации»",
  "Аудио не сохраняется (только расшифровка)",
];

function getDefaultSettings(): AdminSettingsData {
  return {
    passingScore: 88,
    duration: 30,
    questionCount: 10,
    recertPeriod: 6,
    topics: Object.fromEntries(defaultTopics.map((t) => [t, true])),
    legalWarnings: Object.fromEntries(defaultWarnings.map((w) => [w, true])),
  };
}

function loadSettings(): AdminSettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AdminSettingsData;
  } catch {}
  return getDefaultSettings();
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSettingsData>(loadSettings);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast.success("Настройки сохранены");
  }

  function updateField(field: keyof Pick<AdminSettingsData, "passingScore" | "duration" | "questionCount" | "recertPeriod">, value: number) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTopic(topic: string) {
    setSettings((prev) => ({
      ...prev,
      topics: { ...prev.topics, [topic]: !prev.topics[topic] },
    }));
  }

  function toggleWarning(warning: string) {
    setSettings((prev) => ({
      ...prev,
      legalWarnings: { ...prev.legalWarnings, [warning]: !prev.legalWarnings[warning] },
    }));
  }

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
            <Input type="number" value={settings.passingScore} onChange={(e) => updateField("passingScore", Number(e.target.value))} />
          </div>
          <div>
            <Label>Длительность, мин</Label>
            <Input type="number" value={settings.duration} onChange={(e) => updateField("duration", Number(e.target.value))} />
          </div>
          <div>
            <Label>Количество вопросов</Label>
            <Input type="number" value={settings.questionCount} onChange={(e) => updateField("questionCount", Number(e.target.value))} />
          </div>
          <div>
            <Label>Период переаттестации, мес</Label>
            <Input type="number" value={settings.recertPeriod} onChange={(e) => updateField("recertPeriod", Number(e.target.value))} />
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-card space-y-4">
        <h3 className="font-display font-bold text-primary">Темы курса</h3>
        <div className="space-y-2">
          {defaultTopics.map((t) => (
            <div key={t} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-sm">{t}</span>
              <Switch checked={settings.topics[t] ?? true} onCheckedChange={() => toggleTopic(t)} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 shadow-card space-y-3">
        <h3 className="font-display font-bold text-primary">Юридические предупреждения</h3>
        {defaultWarnings.map((p) => (
          <div key={p} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">{p}</span>
            <Switch checked={settings.legalWarnings[p] ?? true} onCheckedChange={() => toggleWarning(p)} />
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90" onClick={handleSave}><Save className="h-4 w-4 mr-1.5" /> Сохранить настройки</Button>
      </div>
    </div>
  );
}
