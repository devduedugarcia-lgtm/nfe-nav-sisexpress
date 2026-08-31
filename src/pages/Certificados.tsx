import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, Trash2, Building2, Calendar, FileKey } from "lucide-react";
import { useCertificados } from "@/hooks/useCertificados";

const formatarCNPJ = (cnpj: string) => {
  const l = cnpj.replace(/\D/g, "");
  return l.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const Certificados = () => {
  const { certificados, carregando, cadastrar, excluir } = useCertificados();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    cnpj: "",
    razao_social: "",
    senha: "",
    validade: "",
    arquivo: null as File | null,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const limparForm = () => {
    setForm({ cnpj: "", razao_social: "", senha: "", validade: "", arquivo: null });
    setErro("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    const cnpjLimpo = form.cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setErro("CNPJ precisa ter 14 dígitos");
      return;
    }
    if (!form.arquivo) {
      setErro("Selecione o arquivo .pfx ou .p12");
      return;
    }

    setSalvando(true);
    try {
      await cadastrar({
        cnpj: form.cnpj,
        razao_social: form.razao_social,
        arquivo: form.arquivo,
        senha: form.senha,
        validade: form.validade || undefined,
      });
      setAberto(false);
      limparForm();
    } catch (err: any) {
      setErro(err.message || "Erro ao cadastrar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileKey size={24} /> Certificados Digitais
          </h2>
          <p className="text-muted-foreground">Gerencie os certificados dos seus clientes</p>
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button>
              <Plus size={16} className="mr-2" /> Novo Certificado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Certificado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              {erro && <div className="p-2 bg-red-50 text-red-600 rounded text-sm">{erro}</div>}

              <div>
                <Label>CNPJ do Cliente</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  maxLength={18}
                />
              </div>

              <div>
                <Label>Razão Social / Nome Fantasia</Label>
                <Input
                  placeholder="Empresa XYZ Ltda"
                  value={form.razao_social}
                  onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                />
              </div>

              <div>
                <Label>Arquivo (.pfx / .p12)</Label>
                <Input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) =>
                    setForm({ ...form, arquivo: e.target.files?.[0] || null })
                  }
                />
              </div>

              <div>
                <Label>Senha do Certificado</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                />
              </div>

              <div>
                <Label>Data de Validade</Label>
                <Input
                  type="date"
                  value={form.validade}
                  onChange={(e) => setForm({ ...form, validade: e.target.value })}
                />
              </div>

              <Button type="submit" disabled={salvando} className="w-full">
                <Upload size={16} className="mr-2" />
                {salvando ? "Salvando..." : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Certificados Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : certificados.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum certificado cadastrado ainda. Clique em "Novo Certificado" para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificados.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Building2 size={14} /> {cert.razao_social}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatarCNPJ(cert.cnpj)}
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <Calendar size={14} />
                      {cert.data_validade ? new Date(cert.data_validade).toLocaleDateString("pt-BR") : "Não informada"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Excluir este certificado?")) excluir(cert.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Certificados;