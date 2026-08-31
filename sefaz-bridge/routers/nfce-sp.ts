import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { xml2js } from "https://deno.land/x/xml2js@1.0.0/mod.ts";

interface BuscaNFCeRequest {
  cnpj: string;
  dataInicio: string;
  dataFim: string;
}

// Converte data ISO (YYYY-MM-DD) para formato DD/MM/AAAA
const formatarData = (dataIso: string) => {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
};

serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // ROTA: Buscar NFC-e por CNPJ e Período
  if (path.endsWith("/buscar-por-cnpj") && req.method === "POST") {
    try {
      const { cnpj, dataInicio, dataFim }: BuscaNFCeRequest = await req.json();

      if (!cnpj || !dataInicio || !dataFim) {
        return new Response(JSON.stringify({ erro: "CNPJ, dataInicio e dataFim são obrigatórios" }), { status: 400 });
      }

      // ⚠️ Aqui é feita a chamada real ao webservice da SEFAZ-SP
      // Endpoint: https://www.nfce.fazenda.sp.gov.br/NFCeListagemChaves/NFCeListagemChaves.asmx
      
      const dadosBusca = {
        cnpj,
        dataInicio: formatarData(dataInicio),
        dataFim: formatarData(dataFim)
      };

      console.log("Buscando NFC-e:", dadosBusca);

      // TODO: Implementar chamada SOAP com certificado digital
      // Por enquanto retorna estrutura esperada
      const notasMock = [
        {
          chaveAcesso: "352608XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          dataEmissao: "28/08/2026",
          valor: 149.90,
          situacao: "Autorizada"
        },
        {
          chaveAcesso: "352608XXXXXXXXXXXXXXXXXXXXXXXXYY",
          dataEmissao: "29/08/2026",
          valor: 87.50,
          situacao: "Autorizada"
        }
      ];

      return new Response(JSON.stringify({ sucesso: true, notas: notasMock }), { status: 200 });

    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao processar busca: " + String(erro) }), { status: 500 });
    }
  }

  // ROTA: Download de XML por Chave de Acesso
  if (path.endsWith("/download-xml") && req.method === "GET") {
    const chave = url.searchParams.get("chave");
    if (!chave) return new Response(JSON.stringify({ erro: "Chave não informada" }), { status: 400 });

    // TODO: Chamar NFCeDownloadXML da SEFAZ-SP
    const xmlExemplo = `<?xml version="1.0" encoding="UTF-8"?>
<NFCe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="${chave}">
    <emit><CNPJ>XXXXXXXXXXXXXX</CNPJ></emit>
    <ide><dhEmi>2026-08-28T12:00:00</dhEmi></ide>
  </infNFe>
</NFCe>`;

    return new Response(xmlExemplo, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${chave}.xml"`
      }
    });
  }

  return new Response(JSON.stringify({ erro: "Rota não encontrada" }), { status: 404 });
});
