import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BadgeCheck, FileKey, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatDateTime } from "@/lib/download";
import {
  deleteCertificate,
  getCertificate,
  getSession,
  testSefazBridge,
  uploadCertificate,
} from "@/lib/nfe.functions";

/** Lê o arquivo escolhido e devolve apenas o conteúdo em base64. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado"));
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_authenticated/certificate")({
  head: () => ({
    meta: [
      { title: "Certificado digital | Gestor de Notas Fiscais" },
      {
        name: "description",
        content: "Envie seu certificado digital A1 (.pfx ou .p12) para autenticar as consultas ao SEFAZ.",
      },
      { property: "og:title", content: "Certificado digital | Gestor de Notas Fiscais" },
      {
        property: "og:description",
        content: "Envie seu certificado digital A1 para autenticar as consultas ao SEFAZ.",
      },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const queryClient = useQueryClient();
  const loadSession = useServerFn(getSession);
  const loadCertificate = useServerFn(getCertificate);
  const sendCertificate = useServerFn(uploadCertificate);
  const removeCertificate = useServerFn(deleteCertificate);
  const checkBridge = useServerFn(testSefazBridge);

  const [fileName, setFileName] = useState("");
  const [password, setPassword] = useState("");
  const fileRef = useRef<File | null>(null);

  const session = useQuery({ queryKey: ["session"], queryFn: () => loadSession() });
  const certificate = useQuery({ queryKey: ["certificate"], queryFn: () => loadCertificate() });
  const bridge = useQuery({ queryKey: ["bridge-health"], queryFn: () => checkBridge() });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current;
      if (!file) throw new Error("Selecione um arquivo .pfx ou .p12");
      const fileBase64 = await readFileAsBase64(file);
      return sendCertificate({ data: { fileName, password, fileBase64 } });
    },
    onSuccess: () => {
      toast.success("Certificado validado e guardado com segurança");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["certificate"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => removeCertificate({}),
    onSuccess: () => {
      toast.success("Certificado removido");
      queryClient.invalidateQueries({ queryKey: ["certificate"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={session.data?.isAdmin} email={session.data?.profile?.email} />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Certificado digital</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O certificado A1 (.pfx ou .p12) autentica as consultas de notas fiscais no SEFAZ. Arquivo
          e senha são validados no envio e guardados cifrados; usamos apenas no servidor, no momento
          da consulta. Cada usuário envia o seu — nada precisa ser configurado manualmente.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <form
            className="space-y-4 rounded-lg border border-border bg-card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (!fileName) {
                toast.error("Selecione um arquivo .pfx ou .p12");
                return;
              }
              upload.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Selecionar arquivo</Label>
              <Input
                id="certificate-file"
                type="file"
                accept=".pfx,.p12"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  fileRef.current = file;
                  setFileName(file?.name ?? "");
                }}
              />
              {fileName && (
                <p className="text-xs text-muted-foreground">
                  Arquivo selecionado: <span className="font-medium text-foreground">{fileName}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate-password">Senha do certificado</Label>
              <Input
                id="certificate-password"
                type="password"
                value={password}
                maxLength={120}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Enviar
            </Button>
          </form>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileKey className="size-4 text-primary" />
              Status
            </h2>
            {certificate.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
            ) : certificate.data ? (
              <div className="mt-3 space-y-2 text-sm">
                {certificate.data.expired ? (
                  <p className="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle className="size-4" />
                    Certificado vencido
                  </p>
                ) : (
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <BadgeCheck className="size-4 text-success" />
                    Certificado ativo
                  </p>
                )}
                <p className="text-muted-foreground">Arquivo: {certificate.data.file_name}</p>
                {certificate.data.subject_name && (
                  <p className="text-muted-foreground">Titular: {certificate.data.subject_name}</p>
                )}
                {certificate.data.holder_cnpj && (
                  <p className="text-muted-foreground">CNPJ: {certificate.data.holder_cnpj}</p>
                )}
                <p className="text-muted-foreground">
                  Válido até: {formatDate(certificate.data.valid_until)}
                  {!certificate.data.expired && certificate.data.daysLeft <= 30 && (
                    <span className="ml-1 text-warning">
                      (faltam {certificate.data.daysLeft} dias)
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  Enviado em: {formatDateTime(certificate.data.uploaded_at)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 size-4" />
                  )}
                  Remover certificado
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum certificado enviado. Envie o arquivo para liberar as consultas ao SEFAZ.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
