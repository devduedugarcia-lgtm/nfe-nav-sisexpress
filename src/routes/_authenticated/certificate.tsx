import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, FileKey, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatDateTime } from "@/lib/download";
import { getCertificate, getSession, uploadCertificate } from "@/lib/nfe.functions";

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

  const [fileName, setFileName] = useState("");
  const [password, setPassword] = useState("");

  const session = useQuery({ queryKey: ["session"], queryFn: () => loadSession() });
  const certificate = useQuery({ queryKey: ["certificate"], queryFn: () => loadCertificate() });

  const upload = useMutation({
    mutationFn: () => sendCertificate({ data: { fileName, password } }),
    onSuccess: () => {
      toast.success("Certificado enviado com sucesso");
      setPassword("");
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
          O certificado A1 (.pfx ou .p12) autentica as consultas de notas fiscais no SEFAZ. A senha
          é usada apenas para validar o envio e não é armazenada.
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
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
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
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <BadgeCheck className="size-4 text-success" />
                  Certificado ativo
                </p>
                <p className="text-muted-foreground">Arquivo: {certificate.data.file_name}</p>
                <p className="text-muted-foreground">
                  Válido até: {formatDate(certificate.data.valid_until)}
                </p>
                <p className="text-muted-foreground">
                  Enviado em: {formatDateTime(certificate.data.uploaded_at)}
                </p>
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
