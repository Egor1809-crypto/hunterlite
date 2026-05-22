import { useState } from "react";
import { Plus, Edit, Trash2, Loader2, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendApi } from "@/lib/frontend-api";
import type { ObjectionTemplateCreateRequestDto, ObjectionTemplateDto } from "@/lib/api-contracts";
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

const AdminObjections = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ObjectionTemplateCreateRequestDto>>({
    difficulty: "medium",
    targetRole: "all",
    answerFormat: "text",
  });

  const { data: objections = [], isLoading } = useQuery({
    queryKey: ["admin", "objections"],
    queryFn: () => frontendApi.getObjectionTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: (newObj: ObjectionTemplateCreateRequestDto) => frontendApi.createObjectionTemplate(newObj),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "objections"] });
      setIsAddOpen(false);
      setFormData({ difficulty: "medium", targetRole: "all", answerFormat: "text" });
    },
  });

  const handleCreate = () => {
    if (!formData.category || !formData.clientPhrase || !formData.referenceAnswer) return;
    createMutation.mutate({
      category: formData.category,
      clientPhrase: formData.clientPhrase,
      targetRole: formData.targetRole ?? "all",
      answerFormat: formData.answerFormat ?? "text",
      referenceAnswer: formData.referenceAnswer,
      explanation: formData.explanation,
      difficulty: formData.difficulty ?? "medium",
    });
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "basic": return "bg-green-500/10 text-green-500";
      case "medium": return "bg-yellow-500/10 text-yellow-500";
      case "hard": return "bg-red-500/10 text-red-500";
      default: return "";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "manager": return "Менеджер";
      case "lawyer": return "Юрист";
      case "all": return "Все роли";
      default: return role;
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Отработка возражений</h1>
          <p className="text-muted-foreground mt-1">
            Управление шаблонами ответов на частые сомнения и отказы клиентов.
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Добавить возражение
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-white/10 bg-black/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>Новое возражение</DialogTitle>
              <DialogDescription>
                Добавьте фразу клиента и эталонный вариант ответа.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div className="grid gap-2">
                <Label>Категория возражения</Label>
                <Input placeholder="Например: Дорого, Не верю, Подумаю..." className="bg-white/5 border-white/10" 
                  value={formData.category || ""} onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Фраза клиента</Label>
                <Textarea placeholder='Например: "У меня нет таких денег на ваши услуги"' className="bg-white/5 border-white/10"
                  value={formData.clientPhrase || ""} onChange={(e) => setFormData(p => ({ ...p, clientPhrase: e.target.value }))} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Целевая роль</Label>
                  <Select value={formData.targetRole} onValueChange={(val) => setFormData(p => ({ ...p, targetRole: val as ObjectionTemplateDto["targetRole"] }))}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все роли</SelectItem>
                      <SelectItem value="manager">Только Менеджер</SelectItem>
                      <SelectItem value="lawyer">Только Юрист</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Формат отработки</Label>
                  <Select value={formData.answerFormat} onValueChange={(val) => setFormData(p => ({ ...p, answerFormat: val as ObjectionTemplateDto["answerFormat"] }))}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Свободный текст</SelectItem>
                      <SelectItem value="voice">Голос (Аудио)</SelectItem>
                      <SelectItem value="options">Выбор вариантов</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2 mt-2">
                <Label className="text-green-400">Эталонный ответ (Reference)</Label>
                <Textarea placeholder="Как идеально должен ответить сотрудник..." className="bg-green-500/5 border-green-500/20 min-h-[100px]"
                  value={formData.referenceAnswer || ""} onChange={(e) => setFormData(p => ({ ...p, referenceAnswer: e.target.value }))} />
              </div>

              <div className="grid gap-2">
                <Label className="text-muted-foreground">Пояснение (опционально)</Label>
                <Input placeholder="Почему именно так нужно отвечать?" className="bg-white/5 border-white/10" 
                  value={formData.explanation || ""} onChange={(e) => setFormData(p => ({ ...p, explanation: e.target.value }))} />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-white/10 hover:bg-white/5" disabled={createMutation.isPending}>
                Отмена
              </Button>
              <Button type="button" onClick={handleCreate} disabled={createMutation.isPending || !formData.category || !formData.clientPhrase || !formData.referenceAnswer}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Загрузка возражений...
          </div>
        ) : objections.length === 0 ? (
          <div className="text-center py-8 border border-white/10 rounded-xl bg-white/5">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">Пока не добавлено ни одного возражения</p>
            <Button variant="outline" onClick={() => setIsAddOpen(true)}>Добавить возражение</Button>
          </div>
        ) : objections.map((obj) => (
          <Card key={obj.id} className="border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all hover:bg-white/10 hover:border-white/20">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="border-white/10 bg-black/50 text-white">
                      {obj.category}
                    </Badge>
                    <Badge variant="outline" className="border-white/10">
                      {getRoleLabel(obj.targetRole)}
                    </Badge>
                    <Badge className={getDifficultyColor(obj.difficulty)}>
                      {obj.difficulty === "basic" ? "Базовая" : obj.difficulty === "medium" ? "Средняя" : "Сложная"}
                    </Badge>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Клиент говорит:</p>
                    <h3 className="text-lg font-medium text-white italic">«{obj.clientPhrase}»</h3>
                  </div>
                  <div className="bg-green-500/5 border border-green-500/10 rounded-md p-3">
                    <p className="text-sm text-green-500/70 mb-1">Ожидаемый ответ (суть):</p>
                    <p className="text-sm text-green-100">{obj.referenceAnswer}</p>
                  </div>
                </div>
                <div className="border-t sm:border-t-0 sm:border-l border-white/10 bg-black/20 p-4 flex sm:flex-col justify-end sm:justify-center gap-2 sm:w-32">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/10">
                    <Edit className="mr-2 h-4 w-4" />
                    Редакт.
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/20">
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

export default AdminObjections;
