import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Clipboard, FileSearch, LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/nfe.functions";
import {
  analyzeSoapDiagnostic,
  type SoapDiagnosticResult,
} from "@/lib/soap-diagnostic.functions";

export const Route = createFileRoute("/_authenticated/admin/soap-diagnostic")({
  head: () => ({
    meta: [
      { title: "Diagnóstico SOAP | Gestor de Notas Fiscais" },
      {
        name: "description",
        content: "Analise mensagens de erro e respostas SOAP da integração fiscal com Lovable AI.",
      },
      { property: "og:title", content: "Diagnóstico SOAP | Gestor de Notas Fiscais" },
      {
        property: "og:description",
        content: "Área administrativa para investigar erros SOAP da integração fiscal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SoapDiagnosticPage,
});

type FormState = {
  context: string;
  errorMessage: string;
  requestSoap: string;
  responseSoap: string;
};

const EMPTY_FORM: FormState = {
  context: "",
  errorMessage: "",
  requestSoap: "",
  responseSoap: "",
};

function resultAsText(result: SoapDiagnosticResult) {
  const lines = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return [
    `CAUSA PROVÁVEL\n${result.probableCause}`,
    `EVIDÊNCIAS\n${lines(result.evidence)}`,
    `CORREÇÕES SUGERIDAS\n${lines(result.suggestedFixes)}`,
    `VERIFICAÇÕES RECOMENDADAS\n${lines(result.recommendedChecks)}`,
    `CONFIANÇA\n${result.confidence}`,
    `OBSERVAÇÃO\n${result.caveat}`,
  ].join("\n\n");
}

function SoapDiagnosticPage() {
  const loadSession = useServerFn(getSession);
  const analyze = useServerFn(analyzeSoapDiagnostic);
  const session = useQuery({ queryKey: ["session"], queryFn: () => loadSession() });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<SoapDiagnosticResult | null>(null);

  const analysis = useMutation({
    mutationFn: (data: FormState) => analyze({ data }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("Diagnóstico concluído");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hasContent = Boolean(
    form.errorMessage.trim() || form.requestSoap.trim() || form.responseSoap.trim(),
  );

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(resultAsText(result));
    toast.success("Diagnóstico copiado");
  }

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

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSearch className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Diagnóstico SOAP</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Investigue falhas da integração fiscal com uma análise técnica do Lovable AI.
            </p>
          </div>
        </div>

        <Alert className="mt-6 border-warning/50 bg-warning/10">
          <AlertTriangle />
          <AlertTitle>Proteção de dados</AlertTitle>
          <AlertDescription>
            Senhas, tokens, certificados e identificadores fiscais reconhecidos são removidos antes
            da análise. O conteúdo e o resultado não são salvos. Revise a hipótese antes de alterar
            ou publicar a integração.
          </AlertDescription>
        </Alert>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <Card className="rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle>Dados para análise</CardTitle>
              <CardDescription>
                Informe o erro e inclua os envelopes disponíveis para obter um diagnóstico mais preciso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  setResult(null);
                  analysis.mutate(form);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="diagnostic-context">Contexto ou etapa</Label>
                  <Textarea
                    id="diagnostic-context"
                    value={form.context}
                    maxLength={1_000}
                    rows={2}
                    placeholder="Ex.: listagem de chaves NFC-e em produção"
                    onChange={(event) => updateField("context", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnostic-error">Mensagem de erro</Label>
                  <Textarea
                    id="diagnostic-error"
                    value={form.errorMessage}
                    maxLength={8_000}
                    rows={4}
                    placeholder="Cole a mensagem completa recebida do serviço"
                    onChange={(event) => updateField("errorMessage", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnostic-request">Requisição SOAP (opcional)</Label>
                  <Textarea
                    id="diagnostic-request"
                    value={form.requestSoap}
                    maxLength={40_000}
                    rows={8}
                    spellCheck={false}
                    className="font-mono text-xs"
                    placeholder="Cole o envelope enviado à SEFAZ"
                    onChange={(event) => updateField("requestSoap", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnostic-response">Resposta SOAP (opcional)</Label>
                  <Textarea
                    id="diagnostic-response"
                    value={form.responseSoap}
                    maxLength={40_000}
                    rows={8}
                    spellCheck={false}
                    className="font-mono text-xs"
                    placeholder="Cole o envelope ou fault devolvido pela SEFAZ"
                    onChange={(event) => updateField("responseSoap", event.target.value)}
                  />
                </div>

                <Button type="submit" disabled={!hasContent || analysis.isPending}>
                  {analysis.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <FileSearch />
                  )}
                  {analysis.isPending ? "Analisando…" : "Analisar erro"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <section aria-live="polite" className="min-h-64">
            {analysis.isPending && (
              <div className="flex min-h-64 flex-col items-center justify-center border-y border-border py-12 text-center">
                <LoaderCircle className="size-7 animate-spin text-primary" />
                <p className="mt-3 font-medium text-foreground">Analisando os indícios…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  O conteúdo sensível já foi removido antes do envio.
                </p>
              </div>
            )}

            {!analysis.isPending && !result && (
              <div className="flex min-h-64 flex-col items-center justify-center border-y border-border py-12 text-center">
                <FileSearch className="size-8 text-muted-foreground" />
                <h2 className="mt-3 font-semibold text-foreground">O diagnóstico aparecerá aqui</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Quanto mais completa for a mensagem recebida, mais específica poderá ser a análise.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Check className="size-5 text-success" />
                      <h2 className="text-lg font-semibold text-foreground">Análise concluída</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.redactionsApplied > 0
                        ? `${result.redactionsApplied} dado(s) sensível(is) removido(s)`
                        : "Nenhum dado sensível reconhecido"}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={copyResult}>
                    <Clipboard />
                    Copiar
                  </Button>
                </div>

                <ResultSection title="Causa provável">
                  <p>{result.probableCause}</p>
                  <Badge variant="secondary" className="mt-3">
                    Confiança {result.confidence}
                  </Badge>
                </ResultSection>
                <ResultList title="Indícios observados" items={result.evidence} />
                <ResultList title="Correções sugeridas" items={result.suggestedFixes} ordered />
                <ResultList title="Verificações recomendadas" items={result.recommendedChecks} />
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>Antes de aplicar</AlertTitle>
                  <AlertDescription>{result.caveat}</AlertDescription>
                </Alert>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-foreground">{children}</div>
    </section>
  );
}

function ResultList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <ResultSection title={title}>
      <List className={ordered ? "list-decimal space-y-2 pl-5" : "list-disc space-y-2 pl-5"}>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </List>
    </ResultSection>
  );
}
