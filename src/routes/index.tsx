import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileStack, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/nfe.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar | Gestor de Notas Fiscais NFe e NFCe" },
      {
        name: "description",
        content:
          "Acesse o Gestor de Notas Fiscais para importar, consultar e baixar XMLs de NFe e NFCe com certificado digital.",
      },
      { property: "og:title", content: "Entrar | Gestor de Notas Fiscais NFe e NFCe" },
      {
        property: "og:description",
        content: "Importe, consulte e baixe XMLs de NFe e NFCe em um único painel.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const loadSession = useServerFn(getSession);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  async function routeByStatus() {
    // Right after sign-in the bearer token may not be attached yet, so retry
    // until the profile is readable.
    let profile: { status: string } | null = null;
    for (let attempt = 0; attempt < 4 && !profile; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400));
      try {
        const session = await loadSession();
        profile = session.profile;
      } catch {
        profile = null;
      }
    }

    if (profile?.status === "approved") {
      navigate({ to: "/dashboard", replace: true });
    } else {
      navigate({ to: "/pending-approval", replace: true });
    }
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        try {
          await routeByStatus();
          return;
        } catch {
          // fall through to the form
        }
      }
      setChecking(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        await routeByStatus();
      } else {
        const { error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Aguarde a aprovação do administrador.");
        await routeByStatus();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a operação";
      toast.error(
        message.includes("Invalid login credentials") ? "E-mail ou senha incorretos" : message,
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <FileStack className="size-5" />
          </span>
          <span className="font-semibold">Gestor de Notas Fiscais</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Todas as suas NFe e NFCe organizadas em um só lugar
          </h1>
          <p className="text-sm text-primary-foreground/80">
            Importe notas por período, confira dados fiscais completos e baixe os XMLs
            individualmente ou em lote para enviar ao contador.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          Consultas simuladas ao SEFAZ para demonstração.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold text-foreground">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Use seu e-mail e senha para acessar o painel."
              : "Novas contas passam por aprovação do administrador."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                maxLength={255}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com.br"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                maxLength={72}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  maxLength={72}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Registrar"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Criar conta" : "Já tenho conta, entrar"}
          </button>

          <div className="mt-8 flex gap-3 rounded-md border border-border bg-secondary/60 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Demo admin:</span> a primeira conta
              criada no sistema entra automaticamente como administradora e já aprovada. Use-a para
              aprovar os próximos cadastros em <span className="font-mono">/admin/users</span>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
