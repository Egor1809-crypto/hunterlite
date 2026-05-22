import { useState } from "react";
import { Plus, Edit, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendApi } from "@/lib/frontend-api";
import type { TestQuestionCreateRequestDto, TestQuestionDto } from "@/lib/api-contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

// Временные типы для UI
type QuestionType = TestQuestionDto["type"];
type QuestionDifficulty = TestQuestionDto["difficulty"];

interface TestQuestion {
  id: string;
  title: string;
  text: string;
  type: QuestionType;
  difficulty: "basic" | "medium" | "hard";
  needsUpdate: boolean;
}

const MOCK_QUESTIONS: TestQuestion[] = [
  {
    id: "1",
    title: "Сумма долга для внесудебного банкротства",
    text: "При какой сумме долга гражданин имеет право подать на внесудебное банкротство через МФЦ (по состоянию на 2026 год)?",
    type: "single_choice",
    difficulty: "basic",
    needsUpdate: false,
  },
  {
    id: "2",
    title: "Последствия процедуры",
    text: "Какие ограничения накладываются на гражданина после завершения процедуры банкротства?",
    type: "multiple_choice",
    difficulty: "medium",
    needsUpdate: false,
  },
];

const AdminTests = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<TestQuestionCreateRequestDto>>({
    type: "single_choice",
    difficulty: "medium",
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["admin", "testQuestions"],
    queryFn: () => frontendApi.getTestQuestions(),
  });

  const createMutation = useMutation({
    mutationFn: (newQuestion: TestQuestionCreateRequestDto) => frontendApi.createTestQuestion(newQuestion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "testQuestions"] });
      setIsAddOpen(false);
      setFormData({ type: "single_choice", difficulty: "medium" });
    },
  });

  const handleCreate = () => {
    if (!formData.title || !formData.text) return; // Simple validation
    createMutation.mutate({
      title: formData.title,
      text: formData.text,
      type: formData.type ?? "single_choice",
      difficulty: formData.difficulty ?? "medium",
      correctAnswer: {}, // Mock
    });
  };

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case "single_choice": return "Один ответ";
      case "multiple_choice": return "Несколько ответов";
      case "true_false": return "Верно/Неверно";
      case "text_input": return "Ввод текста";
      default: return type;
    }
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Банк тестов</h1>
          <p className="text-muted-foreground mt-1">
            Управление вопросами для теоретической проверки сотрудников.
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Создать вопрос
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-white/10 bg-black/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>Создание нового вопроса</DialogTitle>
              <DialogDescription>
                Добавьте формулировку, варианты ответов и укажите эталон для автопроверки.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Тема / Краткое название</Label>
                <Input id="title" placeholder="Например: Сроки подачи заявления" className="bg-white/5 border-white/10" 
                  value={formData.title || ""} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="text">Текст вопроса</Label>
                <Textarea id="text" placeholder="Полная формулировка вопроса..." className="bg-white/5 border-white/10"
                  value={formData.text || ""} onChange={(e) => setFormData(p => ({ ...p, text: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Тип вопроса</Label>
                  <Select value={formData.type} onValueChange={(val) => setFormData(p => ({ ...p, type: val as QuestionType }))}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_choice">Один правильный ответ</SelectItem>
                      <SelectItem value="multiple_choice">Множественный выбор</SelectItem>
                      <SelectItem value="true_false">Верно / Неверно</SelectItem>
                      <SelectItem value="text_input">Ввод текста / числа</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Сложность</Label>
                  <Select value={formData.difficulty} onValueChange={(val) => setFormData(p => ({ ...p, difficulty: val as QuestionDifficulty }))}>
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
              </div>
              
              <div className="rounded-md border border-white/10 bg-white/5 p-4 mt-2">
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  Здесь будет интерфейс добавления вариантов ответов (зависит от типа вопроса)
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-white/10 hover:bg-white/5" disabled={createMutation.isPending}>
                Отмена
              </Button>
              <Button type="button" onClick={handleCreate} disabled={createMutation.isPending || !formData.title || !formData.text}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить в базу
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Загрузка вопросов...
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-8 border border-white/10 rounded-xl bg-white/5">
            <p className="text-muted-foreground mb-4">В банке пока нет вопросов</p>
            <Button variant="outline" onClick={() => setIsAddOpen(true)}>Добавить первый вопрос</Button>
          </div>
        ) : questions.map((q) => (
          <Card key={q.id} className="border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all hover:bg-white/10 hover:border-white/20">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-white/10 bg-black/50">
                      {getTypeLabel(q.type)}
                    </Badge>
                    <Badge className={getDifficultyColor(q.difficulty)}>
                      {q.difficulty === "basic" ? "Базовая" : q.difficulty === "medium" ? "Средняя" : "Сложная"}
                    </Badge>
                    {q.needsUpdate && (
                      <Badge variant="destructive" className="ml-auto animate-pulse">
                        Требует обновления
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{q.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">{q.text}</p>
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

export default AdminTests;
