import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileStack, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = { isAdmin?: boolean; email?: string | null };

export function AppHeader({ isAdmin = false, email }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const linkClass =
    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 text-foreground">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileStack className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Gestor de Notas Fiscais</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link to="/dashboard" className={linkClass} activeProps={{ className: "bg-secondary text-foreground" }}>
            Painel
          </Link>
          <Link to="/certificate" className={linkClass} activeProps={{ className: "bg-secondary text-foreground" }}>
            Certificado
          </Link>
          {isAdmin && (
            <Link to="/admin/users" className={linkClass} activeProps={{ className: "bg-secondary text-foreground" }}>
              Usuários
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {email && <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1.5 size-4" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
