import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

interface BuscaNFCeRequest {
  cnpj: string;
  dataInicio: string;
  dataFim: string;
  certificado_pfx: string;
  senha: string;
}

const formatarData = (dataIso: string) => {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
};

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
    <ide><dhEmi>2026-08-28T12:00:00</dhEmi></ide>
  </infNFe>
</NFCe>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${chave}.xml"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(JSON.stringify({ erro: "Rota não encontrada" }), { status: 404 });
};