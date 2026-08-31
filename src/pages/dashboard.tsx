import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, FileText, Calendar, Building2 } from "lucide-react";
''
// Validação de CNPJ
const validarCNPJ = (cnpj: string) => {
  const limpo = cnpj.replace(/\D/g, "");
  return limpo.length === 14;
};

const Dashboard = () => {
  const [cnpj, setCnpj] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [notas, setNotas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const formatarCNPJ = (valor: string) => {
    const limpo = valor.replace(/\D/g, "");
    if (limpo.length <= 2) return limpo;
    if (limpo.length <= 5) return `${limpo.slice(0, 2)}.${limpo.slice(2)}`;
    if (limpo.length <= 8) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5)}`;
    if (limpo.length <= 12) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8)}`;
    return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`;
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatarCNPJ(e.target.value));
  };

  const buscarNotas = async () => {
    setErro("");
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    if (!validarCNPJ(cnpjLimpo)) {
      setErro("CNPJ inválido! Digite 14 dígitos.");
      return;
    }
    if (!dataInicio || !dataFim) {
      setErro("Informe o período (data inicial e final).");
      return;
    }

    setCarregando(true);
    try {
      const resposta = await fetch("/api/sefaz/nfce-sp/buscar-por-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: cnpjLimpo,
          dataInicio,
          dataFim
        })
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
      window.open(`/api/sefaz/nfce-sp/download-xml?chave=${encodeURIComponent(chave)}`, "_blank");
    } catch (err) {
      alert("Erro ao baixar XML");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Buscar NFC-e por CNPJ</h2>

      {/* Formulário de Busca */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
        <div>
          <Label htmlFor="cnpj" className="flex items-center gap-1">
            <Building2 size={14} /> CNPJ Emitente
          </Label>
          <Input
            id="cnpj"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={handleCNPJChange}
            maxLength={18}
          />
        </div>
        <div>
          <Label htmlFor="dataInicio" className="flex items-center gap-1">
            <Calendar size={14} /> Data Início
          </Label>
          <Input
            id="dataInicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dataFim" className="flex items-center gap-1">
            <Calendar size={14} /> Data Fim
          </Label>
          <Input
            id="dataFim"
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
              {notas.map((nota) => (
                <TableRow key={nota.chaveAcesso}>
                  <TableCell className="font-mono text-xs">{nota.chaveAcesso}</TableCell>
                  <TableCell>{nota.dataEmissao}</TableCell>
                  <TableCell>R$ {nota.valor?.toFixed(2) || "0,00"}</TableCell>
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
