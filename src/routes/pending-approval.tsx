import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pending-approval")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conta aguardando aprovação | Gestor de Notas Fiscais" },
      {
        name: "description",
        content: "Sua conta foi criada e está aguardando a aprovação do administrador do sistema.",
      },
      { property: "og:title", content: "Conta aguardando aprovação" },
      {
        property: "og:description",
        content: "Sua conta foi criada e está aguardando a aprovação do administrador.",
      },
    ],
  }),
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/", replace: true });
        return;
      }
      setEmail(data.user.email ?? null);
    });
  }, [navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent/25 text-accent-foreground">
          <Clock className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-foreground">Aguardando aprovação</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta {email ? <span className="font-medium text-foreground">{email}</span> : null} foi
          criada com sucesso, mas ainda precisa ser aprovada por um administrador antes de acessar as
          notas fiscais.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Você receberá acesso ao painel assim que a liberação for feita. Tente novamente mais tarde.
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" />
          Sair
        </Button>
      </div>
    </main>
  );
}
