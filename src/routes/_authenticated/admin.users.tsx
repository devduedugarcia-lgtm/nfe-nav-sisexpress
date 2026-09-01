import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/download";
import { adminListUsers, adminSetUserStatus, getSession } from "@/lib/nfe.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Administrar usuários | Gestor de Notas Fiscais" },
      {
        name: "description",
        content: "Aprove ou recuse novos cadastros e controle quem acessa o gestor de notas fiscais.",
      },
      { property: "og:title", content: "Administrar usuários | Gestor de Notas Fiscais" },
      {
        property: "og:description",
        content: "Aprove ou recuse novos cadastros do gestor de notas fiscais.",
      },
    ],
  }),
  component: AdminUsersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
};

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const loadSession = useServerFn(getSession);
  const loadUsers = useServerFn(adminListUsers);
  const setStatus = useServerFn(adminSetUserStatus);

  const session = useQuery({ queryKey: ["session"], queryFn: () => loadSession() });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => loadUsers(),
    enabled: session.data?.isAdmin === true,
  });

  const update = useMutation({
    mutationFn: (input: { userId: string; status: "approved" | "rejected" }) =>
      setStatus({ data: input }),
    onSuccess: (_result, input) => {
      toast.success(input.status === "approved" ? "Usuário aprovado" : "Usuário recusado");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (session.isSuccess && !session.data.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader email={session.data.profile?.email} />
        <main className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
          <ShieldAlert className="size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva para administradores do sistema.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={session.data?.isAdmin} email={session.data?.profile?.email} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Administrar usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprove ou recuse os cadastros para controlar quem acessa as notas fiscais.
        </p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando usuários…
                  </TableCell>
                </TableRow>
              )}
              {users.data?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.role === "admin" ? "Administrador" : "Usuário"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.status === "approved"
                          ? "default"
                          : user.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {STATUS_LABEL[user.status] ?? user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          update.isPending ||
                          user.status === "approved" ||
                          user.id === session.data?.userId
                        }
                        onClick={() => update.mutate({ userId: user.id, status: "approved" })}
                      >
                        <Check className="mr-1 size-4" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          update.isPending ||
                          user.status === "rejected" ||
                          user.id === session.data?.userId
                        }
                        onClick={() => update.mutate({ userId: user.id, status: "rejected" })}
                      >
                        <X className="mr-1 size-4" />
                        Recusar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.isSuccess && users.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
