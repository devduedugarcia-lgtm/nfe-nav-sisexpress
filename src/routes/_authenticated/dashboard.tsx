import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CloudDownload,
  Download,
  FileArchive,
  Loader2,
  Receipt,
  Settings2,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadBase64,
  downloadText,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/download";
import {
  clearInvoices,
  exportInvoicesZip,
  getInvoiceXml,
  getSefazAccount,
  getSession,
  listInvoices,
  resetSefazCursor,
  saveSefazAccount,
  searchSefazDemo,
  syncSefaz,
  testSefazBridge,
} from "@/lib/nfe.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de notas fiscais | Gestor de Notas Fiscais" },
      {
        name: "description",
        content:
          "Consulte notas NFe e NFCe por período, veja resumos de faturamento e baixe XMLs individualmente ou em ZIP.",
      },
      { property: "og:title", content: "Painel de notas fiscais" },
      {
        property: "og:description",
        content: "Resumos, filtros e download de XMLs de NFe e NFCe em um só painel.",
      },
    ],
  }),
  component: DashboardPage,
});

type Invoice = {
  id: string;
  access_key: string;
  number: string;
  series: string;
  doc_type: string;
  direction: string;
  issuer_name: string;
  issuer_cnpj: string;
  recipient_name: string;
  recipient_cnpj: string | null;
  issued_at: string;
  total_amount: number;
  status: string;
  xml_content: string;
  source?: string | null;
};

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(preset: string) {
  const today = new Date();
  const to = toInputDate(today);
  if (preset === "current-month") {
    return { from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  if (preset === "last-90") {
    const start = new Date(today);
    start.setDate(start.getDate() - 90);
    return { from: toInputDate(start), to };
  }
  if (preset === "year") {
    return { from: toInputDate(new Date(today.getFullYear(), 0, 1)), to };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  return { from: toInputDate(start), to };
}

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadSession = useServerFn(getSession);
  const fetchInvoices = useServerFn(listInvoices);
  const runDemoSearch = useServerFn(searchSefazDemo);
  const runSefazSync = useServerFn(syncSefaz);
  const loadSefazAccount = useServerFn(getSefazAccount);
  const persistSefazAccount = useServerFn(saveSefazAccount);
  const resetCursor = useServerFn(resetSefazCursor);
  const runBridgeTest = useServerFn(testSefazBridge);
  const fetchXml = useServerFn(getInvoiceXml);
  const exportZip = useServerFn(exportInvoicesZip);
  const wipeInvoices = useServerFn(clearInvoices);

  const [preset, setPreset] = useState("last-30");
  const [range, setRange] = useState(() => periodRange("last-30"));
  const [docType, setDocType] = useState<"all" | "NFe" | "NFCe">("all");
  const [direction, setDirection] = useState<"all" | "entrada" | "saida">("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [mode, setMode] = useState<"demo" | "sefaz">("demo");
  const [configOpen, setConfigOpen] = useState(false);
  const [form, setForm] = useState({ cnpj: "", uf: "SP", environment: "homologacao" });

  const session = useQuery({ queryKey: ["session"], queryFn: () => loadSession() });

  if (session.isSuccess && session.data.profile && session.data.profile.status !== "approved") {
    navigate({ to: "/pending-approval", replace: true });
  }

  const filters = useMemo(
    () => ({ ...range, docType, direction, search: appliedSearch }),
    [range, docType, direction, appliedSearch],
  );

  const invoices = useQuery({
    queryKey: ["invoices", filters],
    queryFn: () => fetchInvoices({ data: filters }) as Promise<Invoice[]>,
  });

  const sefazAccount = useQuery({
    queryKey: ["sefaz-account"],
    queryFn: () => loadSefazAccount(),
  });

  const account = sefazAccount.data?.account ?? null;
  const bridgeConfigured = sefazAccount.data?.bridgeConfigured ?? false;

  const search = useMutation({
    mutationFn: () => runDemoSearch({ data: filters }),
    onSuccess: (result) => {
      toast.success(
        result.imported > 0
          ? `${result.imported} nota(s) de demonstração geradas`
          : "Nenhuma nota nova gerada no período",
      );
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sync = useMutation({
    mutationFn: () => runSefazSync(),
    onSuccess: (result) => {
      if (result.imported > 0) {
        toast.success(`${result.imported} nota(s) importada(s) do SEFAZ · ${result.status}`);
      } else {
        toast.info(result.status);
      }
      if (result.pending > 0) {
        toast.info(`Ainda há ${result.pending} documento(s) na fila. Sincronize novamente.`);
      }
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sefaz-account"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveAccount = useMutation({
    mutationFn: () =>
      persistSefazAccount({
        data: {
          cnpj: form.cnpj,
          uf: form.uf,
          environment: form.environment as "producao" | "homologacao",
        },
      }),
    onSuccess: () => {
      toast.success("Configuração fiscal salva");
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sefaz-account"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restartCursor = useMutation({
    mutationFn: () => resetCursor(),
    onSuccess: () => {
      toast.success("Contador NSU reiniciado: a próxima sincronização busca desde o início");
      queryClient.invalidateQueries({ queryKey: ["sefaz-account"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bridgeTest = useMutation({
    mutationFn: () => runBridgeTest(),
    onSuccess: (result) => {
      const cert = result.certificate?.validUntil
        ? ` · certificado válido até ${result.certificate.validUntil}`
        : "";
      if (result.ok) toast.success(`${result.message}${cert}`);
      else toast.error(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openConfig() {
    setForm({
      cnpj: account?.cnpj ?? "",
      uf: account?.uf ?? "SP",
      environment: account?.environment ?? "homologacao",
    });
    setConfigOpen(true);
  }

  const download = useMutation({
    mutationFn: (id: string) => fetchXml({ data: { id } }),
    onSuccess: (result) => downloadText(result.fileName, result.xml),
    onError: (error: Error) => toast.error(error.message),
  });

  const zip = useMutation({
    mutationFn: () => exportZip({ data: filters }),
    onSuccess: (result) => {
      if (!result.base64) {
        toast.error("Nenhuma nota no filtro atual para exportar");
        return;
      }
      downloadBase64(`notas-fiscais-${range.from}-a-${range.to}.zip`, result.base64);
      toast.success(
        `${result.count} XML(s) exportado(s) · ${result.inbound} em entradas/ e ${result.outbound} em saidas/`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clearAll = useMutation({
    mutationFn: () => wipeInvoices(),
    onSuccess: () => {
      toast.success("Dados do painel limpos");
      setAppliedSearch("");
      setSearchInput("");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = invoices.data ?? [];
  const summary = useMemo(() => {
    const inbound = rows.filter((row) => row.direction === "entrada");
    const outbound = rows.filter((row) => row.direction === "saida");
    const sum = (list: Invoice[]) => list.reduce((total, row) => total + Number(row.total_amount), 0);
    return {
      count: rows.length,
      total: sum(rows),
      inboundCount: inbound.length,
      inboundTotal: sum(inbound),
      outboundCount: outbound.length,
      outboundTotal: sum(outbound),
    };
  }, [rows]);

  function applyPreset(value: string) {
    setPreset(value);
    if (value !== "custom") setRange(periodRange(value));
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={session.data?.isAdmin} email={session.data?.profile?.email} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Painel de notas fiscais - SisExpress</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte o SEFAZ, acompanhe os resumos e baixe os XMLs das notas.
              {"\n\n"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => zip.mutate()} disabled={zip.isPending}>
              {zip.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileArchive className="mr-2 size-4" />
              )}
              Exportar ZIP
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="mr-2 size-4" />
                  Limpar tudo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os dados do painel?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as notas fiscais importadas para a sua conta serão removidas. Esta ação não
                    pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearAll.mutate()}>
                    Limpar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Receipt className="size-4" />}
            label="Notas no período"
            value={String(summary.count)}
            hint={`${summary.inboundCount} entradas · ${summary.outboundCount} saídas`}
          />
          <SummaryCard
            icon={<Wallet className="size-4" />}
            label="Valor total"
            value={formatCurrency(summary.total)}
            hint="Soma das notas filtradas"
          />
          <SummaryCard
            icon={<ArrowDownLeft className="size-4" />}
            label="Entradas"
            value={formatCurrency(summary.inboundTotal)}
            hint={`${summary.inboundCount} nota(s)`}
          />
          <SummaryCard
            icon={<ArrowUpRight className="size-4" />}
            label="Saídas"
            value={formatCurrency(summary.outboundTotal)}
            hint={`${summary.outboundCount} nota(s)`}
          />
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Origem dos dados</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demonstração</SelectItem>
                  <SelectItem value="sefaz">SEFAZ real</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={preset} onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Mês atual</SelectItem>
                  <SelectItem value="last-30">Últimos 30 dias</SelectItem>
                  <SelectItem value="last-90">Últimos 90 dias</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="from">De</Label>
                <Input
                  id="from"
                  type="date"
                  value={range.from}
                  onChange={(event) => {
                    setPreset("custom");
                    setRange((current) => ({ ...current, from: event.target.value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">Até</Label>
                <Input
                  id="to"
                  type="date"
                  value={range.to}
                  onChange={(event) => {
                    setPreset("custom");
                    setRange((current) => ({ ...current, to: event.target.value }));
                  }}
                />
              </div>
            </div>

            <div className="flex items-end">
              {mode === "demo" ? (
                <Button
                  className="w-full"
                  onClick={() => search.mutate()}
                  disabled={search.isPending}
                >
                  {search.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CloudDownload className="mr-2 size-4" />
                  )}
                  Gerar notas de demonstração
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => sync.mutate()}
                  disabled={sync.isPending || !account || !bridgeConfigured}
                >
                  {sync.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CloudDownload className="mr-2 size-4" />
                  )}
                  Sincronizar com o SEFAZ
                </Button>
              )}
            </div>
          </div>

          {mode === "sefaz" && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="space-y-1 text-muted-foreground">
                {account ? (
                  <p className="text-foreground">
                    CNPJ {account.cnpj} · {account.uf} ·{" "}
                    {account.environment === "producao" ? "Produção" : "Homologação"} · NSU{" "}
                    {String(account.ult_nsu)}
                  </p>
                ) : (
                  <p className="text-foreground">Configure o CNPJ e a UF para sincronizar.</p>
                )}
                {account?.last_sync_at && (
                  <p>
                    Última sincronização em {formatDateTime(account.last_sync_at)}
                    {account.last_status ? ` · ${account.last_status}` : ""}
                  </p>
                )}
                {!bridgeConfigured && (
                  <p>
                    Serviço de consulta ao SEFAZ ainda não conectado. Publique o serviço da pasta{" "}
                    <code>sefaz-bridge</code> e cadastre a URL e o token.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bridgeTest.mutate()}
                  disabled={bridgeTest.isPending}
                >
                  {bridgeTest.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Testar conexão
                </Button>
                <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={openConfig}>
                      <Settings2 className="mr-2 size-4" />
                      Configuração fiscal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configuração fiscal</DialogTitle>
                      <DialogDescription>
                        Dados usados na consulta de distribuição de documentos da SEFAZ.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input
                          id="cnpj"
                          value={form.cnpj}
                          maxLength={18}
                          placeholder="00000000000000"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, cnpj: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="uf">UF</Label>
                          <Input
                            id="uf"
                            value={form.uf}
                            maxLength={2}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                uf: event.target.value.toUpperCase(),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ambiente</Label>
                          <Select
                            value={form.environment}
                            onValueChange={(value) =>
                              setForm((current) => ({ ...current, environment: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="homologacao">Homologação</SelectItem>
                              <SelectItem value="producao">Produção</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => saveAccount.mutate()}
                        disabled={saveAccount.isPending}
                      >
                        {saveAccount.isPending && (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restartCursor.mutate()}
                  disabled={restartCursor.isPending || !account}
                >
                  Reiniciar NSU
                </Button>
              </div>
            </div>
          )}
        </section>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(searchInput.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              onBlur={() => setAppliedSearch(searchInput.trim())}
              placeholder="Buscar por emitente, destinatário, chave ou número…"
              className="pl-9"
            />
          </div>
          <Select value={docType} onValueChange={(value) => setDocType(value as typeof docType)}>
            <SelectTrigger className="sm:w-40" aria-label="Tipo de documento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="NFe">NFe</SelectItem>
              <SelectItem value="NFCe">NFCe</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={direction}
            onValueChange={(value) => setDirection(value as typeof direction)}
          >
            <SelectTrigger className="sm:w-40" aria-label="Direção">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="entrada">Recebidas</SelectItem>
              <SelectItem value="saida">Emitidas</SelectItem>
            </SelectContent>
          </Select>
        </form>

        <section className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                  Número
                </TableHead>
                <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wide lg:table-cell">
                  Chave de acesso
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                  Emitente
                </TableHead>
                <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wide md:table-cell">
                  Destinatário
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                  Data
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide">
                  Valor
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                  Tipo
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando notas…
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="py-4 font-semibold">{row.number}</TableCell>
                  <TableCell className="hidden max-w-36 py-4 font-mono text-xs leading-4 break-all text-muted-foreground lg:table-cell">
                    {row.access_key}
                  </TableCell>
                  <TableCell className="max-w-48 truncate py-4">{row.issuer_name}</TableCell>
                  <TableCell className="hidden max-w-48 truncate py-4 md:table-cell">
                    {row.recipient_name}
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {formatDateTime(row.issued_at)}
                  </TableCell>
                  <TableCell className="py-4 text-right font-semibold">
                    {formatCurrency(Number(row.total_amount))}
                  </TableCell>
                  <TableCell className="py-4">
                    <DocTypeBadge type={row.doc_type} />
                    {row.source === "demo" && (
                      <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                        demo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <DirectionLabel direction={row.direction} />
                      {row.status !== "Autorizada" && (
                        <Badge variant="destructive">{row.status}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        download.mutate(row.id);
                      }}
                      aria-label={`Baixar XML da nota ${row.number}`}
                    >
                      <Download className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.isSuccess && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma nota no filtro atual. Use o botão Buscar no SEFAZ para consultar o
                    período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </main>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.doc_type} nº {selected?.number} · série {selected?.series}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Emitente" value={selected.issuer_name} />
                <Detail label="CNPJ emitente" value={selected.issuer_cnpj} />
                <Detail label="Destinatário" value={selected.recipient_name} />
                <Detail label="CNPJ destinatário" value={selected.recipient_cnpj ?? "—"} />
                <Detail label="Emissão" value={formatDate(selected.issued_at)} />
                <Detail
                  label="Direção"
                  value={selected.direction === "entrada" ? "Entrada" : "Saída"}
                />
                <Detail label="Valor total" value={formatCurrency(Number(selected.total_amount))} />
                <Detail label="Situação" value={selected.status} />
              </div>
              <Detail label="Chave de acesso" value={selected.access_key} mono />
              <Button onClick={() => download.mutate(selected.id)}>
                <Download className="mr-2 size-4" />
                Baixar XML
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-primary">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 break-all text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function DocTypeBadge({ type }: { type: string }) {
  const isNfce = type === "NFCe";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
        isNfce ? "border-warning/40 text-warning" : "border-primary/40 text-primary"
      }`}
    >
      {type}
    </span>
  );
}

function DirectionLabel({ direction }: { direction: string }) {
  const inbound = direction === "entrada";
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium ${
        inbound ? "text-warning" : "text-primary"
      }`}
    >
      {inbound ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      {inbound ? "Recebida" : "Emitida"}
    </span>
  );
}
