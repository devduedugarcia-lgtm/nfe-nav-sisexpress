import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
<<<<<<< HEAD
=======
import { xml2js } from "https://deno.land/x/xml2js@1.0.0/mod.ts";
>>>>>>> 2a1496cb50f578d863d4afb35c3728f206b4c889

interface BuscaNFCeRequest {
  cnpj: string;
  dataInicio: string;
  dataFim: string;
<<<<<<< HEAD
  certificado_pfx: string;
  senha: string;
}

=======
}

// Converte data ISO (YYYY-MM-DD) para formato DD/MM/AAAA
>>>>>>> 2a1496cb50f578d863d4afb35c3728f206b4c889
const formatarData = (dataIso: string) => {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
};

<<<<<<< HEAD
export const nfceSpRoutes = async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Buscar NFC-e por CNPJ + Período + Certificado DINÂMICO
  if (path.endsWith("/buscar-por-cnpj") && req.method === "POST") {
    try {
      const { cnpj, dataInicio, dataFim, certificado_pfx, senha }: BuscaNFCeRequest = await req.json();

      if (!cnpj || !dataInicio || !dataFim || !certificado_pfx || !senha) {
        return new Response(JSON.stringify({ erro: "Faltam dados: CNPJ, período e certificado" }), { 
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      // ✅ AQUI O CERTIFICADO É USADO NA CHAMADA À SEFAZ
      // O certificado_pfx e senha vieram DO FRONTEND → não está mais fixo!

      const dadosBusca = {
        cnpj,
        dataInicio: formatarData(dataInicio),
        dataFim: formatarData(dataFim),
        temCertificado: true,
      };

      console.log("📡 Buscando NFC-e:", dadosBusca);

      // ⚠️ Aqui você implementa a chamada SOAP real com o certificado recebido
      // O certificado_pfx está em Base64 — converte para assinar a requisição

      // Dados de exemplo (substituir pela chamada real à SEFAZ)
      const notas = [
        {
          chaveAcesso: `${cnpj}08202608280000000000000000000000000000000001`,
          dataEmissao: "28/08/2026",
          valor: 149.9,
          situacao: "Autorizada",
        },
        {
          chaveAcesso: `${cnpj}08202608290000000000000000000000000000000002`,
          dataEmissao: "29/08/2026",
          valor: 87.5,
          situacao: "Autorizada",
        },
      ];

      return new Response(JSON.stringify({ sucesso: true, notas }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro: " + String(erro) }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }

  // Download XML por Chave
  if (path.includes("/download-xml") && req.method === "GET") {
    const chave = url.searchParams.get("chave");
    const cnpj = url.searchParams.get("cnpj") || "";

    if (!chave) {
      return new Response(JSON.stringify({ erro: "Chave não informada" }), { status: 400 });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFCe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="${chave}">
    <emit><CNPJ>${cnpj}</CNPJ></emit>
=======
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
>>>>>>> 2a1496cb50f578d863d4afb35c3728f206b4c889
    <ide><dhEmi>2026-08-28T12:00:00</dhEmi></ide>
  </infNFe>
</NFCe>`;

<<<<<<< HEAD
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${chave}.xml"`,
        "Access-Control-Allow-Origin": "*",
      },
=======
    return new Response(xmlExemplo, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${chave}.xml"`
      }
>>>>>>> 2a1496cb50f578d863d4afb35c3728f206b4c889
    });
  }

  return new Response(JSON.stringify({ erro: "Rota não encontrada" }), { status: 404 });
<<<<<<< HEAD
};
=======
});
>>>>>>> 2a1496cb50f578d863d4afb35c3728f206b4c889
