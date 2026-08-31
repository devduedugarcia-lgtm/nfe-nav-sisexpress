import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { nfceSpRoutes } from "./routers/nfce-sp.ts";

const PORT = Deno.env.get("PORT") || 8000;

serve(async (req: Request) => {
  // Habilita CORS para permitir acesso do site
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  console.log(`📥 Requisição: ${req.method} ${pathname}`);

  // Rota de status
  if (pathname === "/") {
    return new Response(JSON.stringify({ 
      status: "online", 
      mensagem: "Bridge SEFAZ funcionando! ✅",
      rotas: ["/nfce-sp/buscar-por-cnpj", "/nfce-sp/download-xml"]
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }

  // Usa as rotas da NFC-e SP
  if (pathname.startsWith("/nfce-sp/")) {
    return nfceSpRoutes(req);
  }

  return new Response(JSON.stringify({ erro: "Rota não encontrada" }), { 
    status: 404,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}, { port: Number(PORT) });

console.log(`🚀 Bridge SEFAZ rodando na porta ${PORT}`);