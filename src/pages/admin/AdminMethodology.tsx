import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, Link2, ShieldCheck, Plus, Edit, Trash2, X, Check } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bflMethodologyChapters as staticChapters,
  type MethodologyChapter,
  type MethodologyChapterStatus,
} from "@/lib/methodology";

const LS_KEY = "hunterlite_methodology_chapters";

function loadChapters(): MethodologyChapter[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MethodologyChapter[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* corrupted data — fall back */
  }
  return structuredClone(staticChapters);
}

function saveChapters(chapters: MethodologyChapter[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(chapters));
}

function computeStats(chapters: MethodologyChapter[]) {
  return {
    chapters: chapters.length,
    topics: chapters.reduce((sum, ch) => sum + ch.items.length, 0),
    linkedTrainingBlocks: new Set(chapters.flatMap((ch) => ch.trainingLinks)).size,
  };
}

const statusVariant = (status: string) =>
  status === "Риск" ? "warning" : status === "Важно" ? "info" : "success";

const STATUS_OPTIONS: MethodologyChapterStatus[] = ["База", "Важно", "Риск", "Практика"];

const emptyForm: Omit<MethodologyChapter, "id"> = {
  title: "",
  status: "База",
  owner: "",
  updatedAt: new Date().toLocaleDateString("ru-RU"),
  trainingLinks: [],
  items: [],
};

export default function AdminMethodology() {
  const [chapters, setChapters] = useState<MethodologyChapter[]>(loadChapters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<MethodologyChapter, "id">>(emptyForm);
  const [trainingInput, setTrainingInput] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [formError, setFormError] = useState("");

  const stats = computeStats(chapters);

  const persist = useCallback((next: MethodologyChapter[]) => {
    setChapters(next);
    saveChapters(next);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, updatedAt: new Date().toLocaleDateString("ru-RU") });
    setTrainingInput("");
    setItemInput("");
    setFormError("");
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (ch: MethodologyChapter) => {
    setEditingId(ch.id);
    setFormData({
      title: ch.title,
      status: ch.status,
      owner: ch.owner,
      updatedAt: ch.updatedAt,
      trainingLinks: [...ch.trainingLinks],
      items: [...ch.items],
    });
    setTrainingInput("");
    setItemInput("");
    setFormError("");
    setDialogOpen(true);
  };

  const handleDelete = (ch: MethodologyChapter) => {
    if (!window.confirm(`Удалить главу «${ch.title}»? Это действие нельзя отменить.`)) return;
    persist(chapters.filter((c) => c.id !== ch.id));
  };

  const addTrainingLink = () => {
    const val = trainingInput.trim();
    if (!val) return;
    if (formData.trainingLinks.includes(val)) return;
    setFormData((p) => ({ ...p, trainingLinks: [...p.trainingLinks, val] }));
    setTrainingInput("");
  };

  const removeTrainingLink = (link: string) => {
    setFormData((p) => ({ ...p, trainingLinks: p.trainingLinks.filter((l) => l !== link) }));
  };

  const addItem = () => {
    const val = itemInput.trim();
    if (!val) return;
    setFormData((p) => ({ ...p, items: [...p.items, val] }));
    setItemInput("");
  };

  const removeItem = (idx: number) => {
    setFormData((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      setFormError("Укажите название главы.");
      return;
    }
    if (!formData.owner.trim()) {
      setFormError("Укажите ответственного.");
      return;
    }
    setFormError("");

    const now = new Date().toLocaleDateString("ru-RU");

    if (editingId) {
      const updated: MethodologyChapter = {
        id: editingId,
        title: formData.title.trim(),
        status: formData.status,
        owner: formData.owner.trim(),
        updatedAt: now,
        trainingLinks: formData.trainingLinks,
        items: formData.items,
      };
      persist(chapters.map((c) => (c.id === editingId ? updated : c)));
    } else {
      const newChapter: MethodologyChapter = {
        id: `ch-${Date.now()}`,
        title: formData.title.trim(),
        status: formData.status,
        owner: formData.owner.trim(),
        updatedAt: now,
        trainingLinks: formData.trainingLinks,
        items: formData.items,
      };
      persist([...chapters, newChapter]);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleResetToDefaults = () => {
    if (!window.confirm("Сбросить все изменения и вернуть исходные данные? Это нельзя отменить.")) return;
    const defaults = structuredClone(staticChapters);
    persist(defaults);
  };

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
        <div className="flex gap-2">
          <Button variant="outline" className="bg-card" onClick={handleResetToDefaults}>
            Сбросить
          </Button>
          <Button asChild variant="outline" className="bg-card">
            <Link to="/bfl-book"><BookOpen className="h-4 w-4 mr-1.5" /> Открыть книгу</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Глав", value: stats.chapters, icon: FileText },
          { label: "Тем", value: stats.topics, icon: BookOpen },
          { label: "Связанных блоков", value: stats.linkedTrainingBlocks, icon: Link2 },
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-primary">Матрица методологии</h2>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Добавить главу
          </Button>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-8 border border-border rounded-xl bg-card">
            <p className="text-muted-foreground mb-4">Нет глав методологии</p>
            <Button variant="outline" onClick={openAdd}>Добавить первую главу</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chapter) => (
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
                <div className="flex lg:flex-col gap-2 lg:self-center">
                  <Button variant="outline" size="sm" className="bg-background" onClick={() => openEdit(chapter)}>
                    <Edit className="h-4 w-4 mr-1.5" />
                    Редакт.
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background text-red-400 hover:text-red-300 hover:bg-red-500/20 border-red-500/20"
                    onClick={() => handleDelete(chapter)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Удалить
                  </Button>
                  <Button asChild variant="outline" size="sm" className="bg-background">
                    <Link to="/admin/tests">Связать</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактирование главы" : "Новая глава методологии"}</DialogTitle>
            <DialogDescription>
              Заполните основные поля, добавьте темы и привязки к тренировочным блокам.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="meth-title">Название главы</Label>
              <Input
                id="meth-title"
                placeholder="Например: Основания для банкротства"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="meth-owner">Ответственный</Label>
                <Input
                  id="meth-owner"
                  placeholder="Методолог"
                  value={formData.owner}
                  onChange={(e) => setFormData((p) => ({ ...p, owner: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Статус</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData((p) => ({ ...p, status: val as MethodologyChapterStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Связанные тренировочные блоки</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Например: Экзамен"
                  value={trainingInput}
                  onChange={(e) => setTrainingInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrainingLink(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTrainingLink}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.trainingLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {formData.trainingLinks.map((link) => (
                    <span
                      key={link}
                      className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
                    >
                      {link}
                      <button
                        type="button"
                        onClick={() => removeTrainingLink(link)}
                        className="ml-0.5 rounded-full hover:bg-accent/40 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Темы (пункты главы)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Например: Признаки неплатежеспособности"
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.items.length > 0 && (
                <div className="space-y-1 mt-1">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        <span>{item}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-red-400 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {formError && <p className="text-sm font-medium text-red-400">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-1.5" />
              {editingId ? "Сохранить изменения" : "Создать главу"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
