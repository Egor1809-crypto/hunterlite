import { useState } from "react";
import { Plus, Edit, Trash2, Loader2, PhoneCall, Network } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendApi } from "@/lib/frontend-api";
import type { CallScriptCreateRequestDto, CallScriptDto, CallScriptNodeCreateRequestDto } from "@/lib/api-contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";

type ClientProfileForm = {
  name?: string;
  debt?: string;
  type?: string;
};

type KeywordRulesForm = {
  requires?: string;
  forbids?: string;
};

type CallScriptNodeForm = Omit<CallScriptNodeCreateRequestDto, "keywordRules"> & {
  keywordRules?: KeywordRulesForm | null;
};

type CallScriptForm = Omit<CallScriptCreateRequestDto, "clientProfile" | "nodes"> & {
  clientProfile: ClientProfileForm;
  nodes: CallScriptNodeForm[];
};

const defaultNode = (): CallScriptNodeForm => ({
  clientReplica: "",
  answerFormat: "text",
  isSuccessEnd: false,
  isFailEnd: false,
  keywordRules: { requires: "", forbids: "" },
});

const initialForm = (): CallScriptForm => ({
  title: "",
  clientProfile: { name: "Иван Иванович", debt: "1 500 000 руб", type: "Ипотека" },
  nodes: [defaultNode()],
});

const getClientProfile = (profile: unknown): ClientProfileForm =>
  typeof profile === "object" && profile !== null ? profile as ClientProfileForm : {};

const splitKeywordInput = (value?: string) =>
  value ? value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) : [];

const AdminCallScripts = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<CallScriptDto | null>(null);
  const [formError, setFormError] = useState("");
  
  const [formData, setFormData] = useState<CallScriptForm>(initialForm);

  const { data: scripts = [], isLoading, isError } = useQuery({
    queryKey: ["admin", "callScripts"],
    queryFn: () => frontendApi.getCallScripts(),
  });

  const resetForm = () => {
    setEditingScript(null);
    setFormError("");
    setFormData(initialForm());
  };

  const createMutation = useMutation({
    mutationFn: (newScript: CallScriptCreateRequestDto) => frontendApi.createCallScript(newScript),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "callScripts"] });
      setIsAddOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CallScriptCreateRequestDto }) =>
      frontendApi.updateCallScript(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "callScripts"] });
      setIsAddOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: frontendApi.deleteCallScript,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "callScripts"] });
    },
  });

  const toKeywordInput = (value: unknown) => Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : "";

  const openEdit = (script: CallScriptDto) => {
    setEditingScript(script);
    setFormData({
      title: script.title,
      clientProfile: getClientProfile(script.clientProfile),
      nodes: (script.nodes || []).map((node) => {
        const rules = node.keywordRules as { requires?: unknown; forbids?: unknown } | null | undefined;

        return {
          clientReplica: node.clientReplica,
          answerFormat: node.answerFormat,
          options: node.options,
          isSuccessEnd: node.isSuccessEnd,
          isFailEnd: node.isFailEnd,
          keywordRules: {
            requires: toKeywordInput(rules?.requires),
            forbids: toKeywordInput(rules?.forbids),
          },
        };
      }),
    });
    setIsAddOpen(true);
  };

  const handleSave = () => {
    const invalidNode = formData.nodes.find((node) => !node.clientReplica.trim());

    if (!formData.title.trim()) {
      setFormError("Укажите название симуляции.");
      return;
    }
    if (formData.nodes.length === 0 || invalidNode) {
      setFormError("Каждый узел должен содержать реплику клиента.");
      return;
    }
    setFormError("");
    
    const formattedNodes: CallScriptNodeCreateRequestDto[] = formData.nodes.map(node => {
      const rules = node.keywordRules;
      return {
        ...node,
        keywordRules: rules ? {
          requires: splitKeywordInput(rules.requires),
          forbids: splitKeywordInput(rules.forbids),
        } : null
      };
    });

    const payload: CallScriptCreateRequestDto = {
      title: formData.title.trim(),
      clientProfile: formData.clientProfile,
      nodes: formattedNodes,
    };

    if (editingScript) {
      updateMutation.mutate({ id: editingScript.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center">
            <PhoneCall className="mr-3 h-8 w-8 text-primary" />
            Симуляции звонков
          </h1>
          <p className="text-muted-foreground mt-1">
            Конструктор ветвящихся диалогов (скриптов) для тренировки общения с клиентом.
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
              Создать скрипт
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] border-white/10 bg-black/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{editingScript ? "Редактирование скрипта звонка" : "Новый скрипт звонка"}</DialogTitle>
              <DialogDescription>
                Задайте профиль клиента и настройте узлы диалога (реплики).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto px-2">
              <div className="grid gap-2">
                <Label>Название симуляции</Label>
                <Input placeholder="Например: Входящий звонок. Ипотека и потреб." className="bg-white/5 border-white/10" 
                  value={formData.title || ""} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
              </div>
              
              <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                <Label className="text-base mb-3 block">Профиль клиента (JSON-формат)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Имя клиента</Label>
                    <Input className="bg-black/50 border-white/10 h-8" value={formData.clientProfile.name || ""} 
                      onChange={e => setFormData(p => ({ ...p, clientProfile: { ...p.clientProfile, name: e.target.value } }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Сумма долга</Label>
                    <Input className="bg-black/50 border-white/10 h-8" value={formData.clientProfile.debt || ""} 
                      onChange={e => setFormData(p => ({ ...p, clientProfile: { ...p.clientProfile, debt: e.target.value } }))} />
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <Label className="text-base flex items-center mb-4">
                  <Network className="mr-2 h-4 w-4" /> Узлы диалога (Реплики клиента)
                </Label>
                <p className="text-xs text-muted-foreground mb-4">
                  *В MVP мы просто задаем линейную/плоскую цепочку реплик для отработки.
                </p>

                {formData.nodes.map((node, idx) => (
                  <div key={idx} className="mb-4 p-4 border border-white/10 rounded-lg bg-white/5 space-y-3 relative">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-primary">Узел {idx + 1}</span>
                      {idx > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-red-400 hover:text-red-300" onClick={() => {
                          const newNodes = [...formData.nodes];
                          newNodes.splice(idx, 1);
                          setFormData(p => ({ ...p, nodes: newNodes }));
                        }}>Удалить</Button>
                      )}
                    </div>
                    
                    <div className="grid gap-2">
                      <Label className="text-sm text-white">Реплика клиента</Label>
                      <Input placeholder="«Алло, я по поводу банкротства...»" className="bg-black/50 border-white/10" 
                        value={node.clientReplica} onChange={e => {
                          const newNodes = [...formData.nodes];
                          newNodes[idx].clientReplica = e.target.value;
                          setFormData(p => ({ ...p, nodes: newNodes }));
                        }} />
                    </div>

                    <div className="flex gap-4">
                      <div className="grid gap-2 flex-1">
                        <Label className="text-xs text-muted-foreground">Обязательные слова (через запятую)</Label>
                        <Input placeholder="суд, документы, банкротство" className="bg-black/50 border-white/10 h-8" 
                          value={node.keywordRules?.requires || ""} onChange={e => {
                            const newNodes = [...formData.nodes];
                            newNodes[idx].keywordRules = { ...(newNodes[idx].keywordRules ?? {}), requires: e.target.value };
                            setFormData(p => ({ ...p, nodes: newNodes }));
                          }} />
                      </div>
                      <div className="grid gap-2 flex-1">
                        <Label className="text-xs text-muted-foreground">Запрещенные слова (через запятую)</Label>
                        <Input placeholder="гарантия, 100%, точно" className="bg-black/50 border-white/10 h-8" 
                          value={node.keywordRules?.forbids || ""} onChange={e => {
                            const newNodes = [...formData.nodes];
                            newNodes[idx].keywordRules = { ...(newNodes[idx].keywordRules ?? {}), forbids: e.target.value };
                            setFormData(p => ({ ...p, nodes: newNodes }));
                          }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <Label className="mb-1 block text-xs">Формат ответа сотрудника</Label>
                        <Select value={node.answerFormat} onValueChange={(val) => {
                          const newNodes = [...formData.nodes];
                          newNodes[idx].answerFormat = val as CallScriptNodeCreateRequestDto["answerFormat"];
                          setFormData(p => ({ ...p, nodes: newNodes }));
                        }}>
                          <SelectTrigger className="bg-black/50 border-white/10 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Текстовый ответ</SelectItem>
                            <SelectItem value="options">Выбор вариантов</SelectItem>
                            <SelectItem value="voice">Голосовой ответ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center space-x-2 pt-5">
                        <Switch id={`success-${idx}`} checked={node.isSuccessEnd} onCheckedChange={(val) => {
                          const newNodes = [...formData.nodes];
                          newNodes[idx].isSuccessEnd = val;
                          setFormData(p => ({ ...p, nodes: newNodes }));
                        }} />
                        <Label htmlFor={`success-${idx}`} className="text-xs">Успешный финал</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2 pt-5">
                        <Switch id={`fail-${idx}`} checked={node.isFailEnd} onCheckedChange={(val) => {
                          const newNodes = [...formData.nodes];
                          newNodes[idx].isFailEnd = val;
                          setFormData(p => ({ ...p, nodes: newNodes }));
                        }} />
                        <Label htmlFor={`fail-${idx}`} className="text-xs">Провальный финал</Label>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button variant="outline" size="sm" className="w-full border-dashed border-white/20 mt-2" onClick={() => {
                  setFormData(p => ({ ...p, nodes: [...p.nodes, defaultNode()] }));
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Добавить узел
                </Button>
              </div>
            </div>
            
            <DialogFooter className="mt-2 border-t border-white/10 pt-4">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-white/10 hover:bg-white/5" disabled={isSaving}>
                Отмена
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || !formData.title}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingScript ? "Сохранить изменения" : "Сохранить скрипт"}
              </Button>
            </DialogFooter>
            {formError ? <p className="text-sm font-medium text-red-300">{formError}</p> : null}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center bg-white/5 rounded-xl border border-white/10">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            Загрузка скриптов...
          </div>
        ) : isError ? (
          <div className="text-center py-12 border border-red-500/20 rounded-xl bg-red-500/5">
            <p className="text-red-200 mb-4">Не удалось загрузить скрипты звонков.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "callScripts"] })}>Повторить</Button>
          </div>
        ) : scripts.length === 0 ? (
          <div className="text-center py-12 border border-white/10 rounded-xl bg-white/5">
            <Network className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">Скрипты звонков пока не созданы</p>
            <Button variant="outline" onClick={() => setIsAddOpen(true)}>Создать первый скрипт</Button>
          </div>
        ) : scripts.map((s) => {
          const profile = getClientProfile(s.clientProfile);

          return (
            <Card key={s.id} className="border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all hover:bg-white/10 hover:border-white/20">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="p-6 flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">{s.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 bg-black/30 p-2 rounded-md inline-flex">
                      <span><strong>Клиент:</strong> {profile.name || "Аноним"}</span>
                      <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                      <span><strong>Долг:</strong> {profile.debt || "Не указан"}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                        Узлов диалога: {s.nodes?.length || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-t sm:border-t-0 sm:border-l border-white/10 bg-black/20 p-4 flex sm:flex-col justify-end sm:justify-center gap-2 sm:w-32">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/10"
                      onClick={() => openEdit(s)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Редакт.
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Удалить скрипт «${s.title}»? Это действие нельзя отменить.`)) {
                          deleteMutation.mutate(s.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCallScripts;
