import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { frontendApi } from "@/lib/frontend-api";
import type { AdminUserCreateRequestDto } from "@/lib/api-contracts";
import { Loader2, Plus, Search, Users } from "lucide-react";

const roleOptions = [
  { value: "employee", label: "Юрист" },
  { value: "manager", label: "Руководитель" },
  { value: "admin", label: "Администратор" },
] as const;

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState<AdminUserCreateRequestDto>({
    name: "",
    email: "",
    role: "employee",
    password: "hunterlite-demo",
  });

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: frontendApi.getAdminUsers,
  });

  const createMutation = useMutation({
    mutationFn: frontendApi.createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsAddOpen(false);
      setFormData({ name: "", email: "", role: "employee", password: "hunterlite-demo" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "blocked" }) =>
      frontendApi.updateAdminUser(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !needle ||
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesQuery && matchesRole;
    });
  }, [query, roleFilter, users]);

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.email.trim()) return;

    createMutation.mutate({
      ...formData,
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к системе" fallback="/admin" />

      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <IconBadge icon={Users} />
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Пользователи</h1>
            <p className="text-muted-foreground mt-1">Управление учётными записями и ролями.</p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1.5" /> Добавить пользователя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый пользователь</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-name">Имя</Label>
                <Input
                  id="admin-user-name"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-email">Email</Label>
                <Input
                  id="admin-user-email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-role">Роль</Label>
                <select
                  id="admin-user-role"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.role}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: event.target.value as AdminUserCreateRequestDto["role"],
                    }))
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-password">Временный пароль</Label>
                <Input
                  id="admin-user-password"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.name.trim() || !formData.email.trim()}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 shadow-card flex gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="all">Все роли</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-semibold">Пользователь</th>
                <th className="text-left p-3 font-semibold">Email</th>
                <th className="text-left p-3 font-semibold">Роль</th>
                <th className="text-left p-3 font-semibold">Статус</th>
                <th className="text-right p-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Загружаем пользователей...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-destructive">
                    Не удалось загрузить пользователей.
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Пользователи не найдены.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3 text-muted-foreground">{user.email}</td>
                    <td className="p-3">{user.roleLabel}</td>
                    <td className="p-3">
                      <StatusBadge variant={user.status === "blocked" ? "destructive" : "success"} dot>
                        {user.statusLabel}
                      </StatusBadge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm">Сбросить пароль</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={user.status === "blocked" ? "" : "text-destructive"}
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: user.id,
                            status: user.status === "blocked" ? "active" : "blocked",
                          })
                        }
                      >
                        {user.status === "blocked" ? "Разблокировать" : "Блокировать"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
