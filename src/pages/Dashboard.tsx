import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Calendar, Building2, FileKey } from "lucide-react";
import { useCertificados } from "@/hooks/useCertificados";

const BRIDGE_URL = import.meta.env.VITE_SEFAZ_BRIDGE_URL || "https://sefaz-bridge-a33m.onrender.com";

const formatarCNPJ = (cnpj: string) => {
  const l = cnpj.replace(/\D/g, "");
  return l.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const Dashboard = () => {
  const { certificados, carregar, obterParaBusca } = useCertificados();
  const [certificadoId, setCertificadoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [notas, setNotas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { carregar(); }, []);

  const buscarNotas = async () => {
    setErro("");
    setNotas([]);

    if (!certificadoId) {
      setErro("Selecione um certificado");
      return;
    }
    if (!dataInicio || !dataFim) {
      setErro("Informe o período");
      return;
    }

    setCarregando(true);
    try {
      // Obtém o certificado completo do banco
      const cert = await obterParaBusca(certificadoId);

      // Envia CNPJ + Período + CERTIFICADO para a bridge
      const resposta = await fetch(`${BRIDGE_URL}/nfce-sp/buscar-por-cnpj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: cert.cnpj,
          dataInicio,
          dataFim,
          certificado_pfx: cert.certificado_pfx,
          senha: cert.senha,
        }),
      });

      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Erro na busca");

      setNotas(dados.notas || []);
    } catch (err: any) {
      setErro(err.message || "Falha ao buscar notas");
    } finally {
      setCarregando(false);
    }
  };

  const baixarXML = async (chave: string) => {
    try {
      const cert = await obterParaBusca(certificadoId);
      window.open(
        `${BRIDGE_URL}/nfce-sp/download-xml?chave=${encodeURIComponent(chave)}&cnpj=${cert.cnpj}`,
        "_blank"
      );
    } catch {
      alert("Erro ao baixar XML");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Buscar NFC-e por Período</h2>

      {/* Formulário de Busca */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
        <div>
          <Label className="flex items-center gap-1">
            <FileKey size={14} /> Certificado / Cliente
          </Label>
          <Select value={certificadoId} onValueChange={setCertificadoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {certificados.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhum certificado cadastrado</p>
              ) : (
                certificados.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.razao_social} — {formatarCNPJ(c.cnpj)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Data Início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>

        <div>
          <Label>Data Fim</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button onClick={buscarNotas} disabled={carregando} className="w-full gap-2">
            <Search size={16} />
            {carregando ? "Buscando..." : "Buscar Notas"}
          </Button>
        </div>
      </div>

      {erro && <div className="p-3 bg-red-50 text-red-600 rounded border">{erro}</div>}

      {/* Resultados */}
      {notas.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="p-3 bg-muted/30 font-medium">
            {notas.length} nota(s) encontrada(s)
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave de Acesso</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.map((nota, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{nota.chaveAcesso}</TableCell>
                  <TableCell>{nota.dataEmissao}</TableCell>
                  <TableCell>R$ {(nota.valor || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      nota.situacao === "Autorizada" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {nota.situacao}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => baixarXML(nota.chaveAcesso)}>
                      <Download size={14} className="mr-1" /> XML
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;