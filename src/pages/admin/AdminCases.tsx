import { useState } from "react";
import { Plus, Edit, Trash2, Loader2, GitBranch } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendApi } from "@/lib/frontend-api";
import type { CaseTemplateCreateRequestDto, CaseStepCreateRequestDto, CaseTemplateDto } from "@/lib/api-contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const AdminCases = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CaseTemplateDto | null>(null);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState<Partial<CaseTemplateCreateRequestDto>>({
    difficulty: "medium",
    steps: [{ question: "", answerFormat: "options", isRedFlag: false }],
  });

  const { data: cases = [], isLoading, isError } = useQuery({
    queryKey: ["admin", "cases"],
    queryFn: () => frontendApi.getCaseTemplates(),
  });

  const resetForm = () => {
    setEditingItem(null);
    setFormError("");
    setFormData({ difficulty: "medium", steps: [{ question: "", answerFormat: "options", isRedFlag: false }] });
  };

  const createMutation = useMutation({
    mutationFn: (newCase: CaseTemplateCreateRequestDto) => frontendApi.createCaseTemplate(newCase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
      setIsAddOpen(false);
      resetForm();
    },
  });

  const openEdit = (c: CaseTemplateDto) => {
    setEditingItem(c);
    setFormData({
      title: c.title,
      introText: c.introText,
      difficulty: c.difficulty,
      steps: (c.steps || []).map((s) => ({
        question: s.question,
        answerFormat: s.answerFormat,
        isRedFlag: s.isRedFlag ?? false,
      })),
    });
    setIsAddOpen(true);
  };

  const handleDelete = (c: CaseTemplateDto) => {
    if (!window.confirm(`Удалить кейс «${c.title}»? Это действие нельзя отменить.`)) return;
    // TODO: wire to API delete endpoint
    queryClient.setQueryData<CaseTemplateDto[]>(["admin", "cases"], (old) =>
      (old || []).filter((item) => item.id !== c.id)
    );
  };

  const handleSave = () => {
    const steps = formData.steps ?? [];

    if (!formData.title?.trim() || !formData.introText?.trim()) {
      setFormError("Заполните название и вводную кейса.");
      return;
    }
    if (steps.length === 0 || steps.some((step) => !step.question.trim())) {
      setFormError("Добавьте хотя бы один шаг и заполните вопросы.");
      return;
    }
    setFormError("");

    if (editingItem) {
      const updated: CaseTemplateDto = {
        ...editingItem,
        title: formData.title!.trim(),
        introText: formData.introText!.trim(),
        difficulty: formData.difficulty ?? "medium",
        steps: steps.map((s, idx) => ({
          id: editingItem.steps?.[idx]?.id ?? `step-${idx}`,
          question: s.question,
          answerFormat: s.answerFormat,
          isRedFlag: s.isRedFlag ?? false,
          options: editingItem.steps?.[idx]?.options,
        })),
      };
      queryClient.setQueryData<CaseTemplateDto[]>(["admin", "cases"], (old) =>
        (old || []).map((item) => (item.id === editingItem.id ? updated : item))
      );
      setIsAddOpen(false);
      resetForm();
      return;
    }

    createMutation.mutate({
      title: formData.title.trim(),
      introText: formData.introText.trim(),
      difficulty: formData.difficulty ?? "medium",
      attachments: [],
      tags: [],
      steps,
    });
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "basic": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
      case "hard": return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
      default: return "";
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Ситуационные кейсы</h1>
          <p className="text-muted-foreground mt-1">
            Сценарии с шагами и красными флагами для проверки навыков.
          </p>
        </div>

        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Создать кейс
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] border-white/10 bg-black/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Редактирование кейса" : "Создание ситуационного кейса"}</DialogTitle>
              <DialogDescription>
                Опишите вводную часть ситуации и добавьте шаги для пользователя.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
              <div className="grid gap-2">
                <Label htmlFor="title">Название кейса</Label>
                <Input id="title" placeholder="Например: Клиент с ипотекой и долгом 2 млн" className="bg-white/5 border-white/10" 
                  value={formData.title || ""} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="intro">Вводная для сотрудника</Label>
                <Textarea id="intro" placeholder="Описание начальной ситуации..." className="bg-white/5 border-white/10"
                  value={formData.introText || ""} onChange={(e) => setFormData(p => ({ ...p, introText: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Сложность</Label>
                <Select value={formData.difficulty} onValueChange={(val) => setFormData(p => ({ ...p, difficulty: val as CaseTemplateDto["difficulty"] }))}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Базовая</SelectItem>
                    <SelectItem value="medium">Средняя</SelectItem>
                    <SelectItem value="hard">Сложная</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <Label className="text-base flex items-center mb-4">
                  <GitBranch className="mr-2 h-4 w-4" /> Шаги сценария
                </Label>
                {(formData.steps || []).map((step, idx) => (
                  <div key={idx} className="mb-4 p-4 border border-white/10 rounded-lg bg-white/5 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Шаг {idx + 1}</span>
                      {idx > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-red-400" onClick={() => {
                          const newSteps = [...(formData.steps || [])];
                          newSteps.splice(idx, 1);
                          setFormData(p => ({ ...p, steps: newSteps }));
                        }}>Удалить</Button>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Вопрос / Действие</Label>
                      <Input placeholder="Что вы спросите у клиента?" className="bg-white/5 border-white/10" 
                        value={step.question} onChange={e => {
                          const newSteps = [...(formData.steps || [])];
                          newSteps[idx].question = e.target.value;
                          setFormData(p => ({ ...p, steps: newSteps }));
                        }} />
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <Label className="mb-1 block text-xs">Формат ответа</Label>
                        <Select value={step.answerFormat} onValueChange={(val) => {
                          const newSteps = [...(formData.steps || [])];
                          newSteps[idx].answerFormat = val as CaseStepCreateRequestDto["answerFormat"];
                          setFormData(p => ({ ...p, steps: newSteps }));
                        }}>
                          <SelectTrigger className="bg-white/5 border-white/10 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="options">Выбор вариантов</SelectItem>
                            <SelectItem value="text">Текстовый ввод (проверка по словам)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed border-white/20" onClick={() => {
                  setFormData(p => ({ ...p, steps: [...(p.steps || []), { question: "", answerFormat: "options", isRedFlag: false }] }));
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Добавить шаг
                </Button>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-white/10 hover:bg-white/5" disabled={createMutation.isPending}>
                Отмена
              </Button>
              <Button type="button" onClick={handleSave} disabled={createMutation.isPending || !formData.title || !formData.introText}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Сохранить изменения" : "Сохранить кейс"}
              </Button>
            </DialogFooter>
            {formError ? <p className="text-sm font-medium text-red-300">{formError}</p> : null}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Загрузка кейсов...
          </div>
        ) : isError ? (
          <div className="text-center py-8 border border-red-500/20 rounded-xl bg-red-500/5">
            <p className="text-red-200 mb-4">Не удалось загрузить ситуационные кейсы.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "cases"] })}>Повторить</Button>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-8 border border-white/10 rounded-xl bg-white/5">
            <p className="text-muted-foreground mb-4">Пока нет ни одного ситуационного кейса</p>
            <Button variant="outline" onClick={() => setIsAddOpen(true)}>Создать первый кейс</Button>
          </div>
        ) : cases.map((c) => (
          <Card key={c.id} className="border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all hover:bg-white/10 hover:border-white/20">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getDifficultyColor(c.difficulty)}>
                      {c.difficulty === "basic" ? "Базовая" : c.difficulty === "medium" ? "Средняя" : "Сложная"}
                    </Badge>
                    <Badge variant="outline" className="border-white/10 bg-black/50">
                      Шагов: {c.steps?.length || 0}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{c.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{c.introText}</p>
                </div>
                <div className="border-t sm:border-t-0 sm:border-l border-white/10 bg-black/20 p-4 flex sm:flex-col justify-end sm:justify-center gap-2 sm:w-32">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/10"
                    onClick={() => openEdit(c)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Редакт.
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    onClick={() => handleDelete(c)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminCases;
