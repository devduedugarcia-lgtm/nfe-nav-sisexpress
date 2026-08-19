// Ponte SEFAZ: recebe pedidos autenticados do app e consulta o webservice
// NFeDistribuicaoDFe usando TLS mutuo com o certificado digital A1 da empresa.
//
// Este servico NAO faz parte do build do app. Hospede-o separadamente (Render,
// Railway, Fly.io ou VPS) — veja o README desta pasta.

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import https from "node:https";
import express from "express";

const PORT = process.env.PORT || 8787;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
const CERT_PFX_PATH = process.env.CERT_PFX_PATH;
const CERT_PFX_BASE64 = process.env.CERT_PFX_BASE64;
const CERT_PASSWORD = process.env.CERT_PASSWORD;

if (!BRIDGE_TOKEN) throw new Error("BRIDGE_TOKEN nao configurado");
if (!CERT_PASSWORD) throw new Error("CERT_PASSWORD nao configurado");
if (!CERT_PFX_PATH && !CERT_PFX_BASE64) {
  throw new Error("Informe CERT_PFX_PATH ou CERT_PFX_BASE64");
}

const pfx = CERT_PFX_BASE64
  ? Buffer.from(CERT_PFX_BASE64, "base64")
  : readFileSync(CERT_PFX_PATH);

const agent = new https.Agent({
  pfx,
  passphrase: CERT_PASSWORD,
  keepAlive: true,
  // A SEFAZ ainda usa cadeias antigas em alguns estados; mantenha a validacao
  // ligada e adicione a CA em NODE_EXTRA_CA_CERTS se necessario.
  rejectUnauthorized: true,
  minVersion: "TLSv1.2",
});

const ENDPOINTS = {
  producao: "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  homologacao: "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
};

const UF_CODES = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22,
  CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32,
  RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53,
};

function buildEnvelope({ cnpj, uf, ambiente, ultNSU }) {
  const cUF = UF_CODES[uf];
  if (!cUF) throw new Error(`UF invalida: ${uf}`);
  const tpAmb = ambiente === "producao" ? 1 : 2;
  const nsu = String(ultNSU ?? 0).padStart(15, "0");

  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.35">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUF}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${nsu}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? match[1].trim() : null;
}

function parseDocs(xml) {
  const docs = [];
  const regex = /<docZip\s+NSU="(\d+)"\s+schema="([^"]+)"[^>]*>([\s\S]*?)<\/docZip>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const [, nsu, schema, payload] = match;
    let content = "";
    try {
      content = gunzipSync(Buffer.from(payload.replace(/\s+/g, ""), "base64")).toString("utf8");
    } catch {
      content = "";
    }
    docs.push({ nsu: Number(nsu), schema, xml: content });
  }
  return docs;
}

async function callSefaz(body, ambiente) {
  const url = ENDPOINTS[ambiente] ?? ENDPOINTS.homologacao;
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        agent,
        hostname: target.hostname,
        path: target.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 60_000,
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`SEFAZ respondeu ${response.statusCode}: ${text.slice(0, 400)}`));
            return;
          }
          resolve(text);
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("Tempo esgotado na SEFAZ")));
    request.on("error", reject);
    request.end(body);
  });
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const header = req.headers.authorization ?? "";
  if (header !== `Bearer ${BRIDGE_TOKEN}`) {
    return res.status(401).json({ error: "Nao autorizado" });
  }
  return next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/distribuicao", async (req, res) => {
  const { cnpj, uf, ambiente = "homologacao", ultNSU = 0 } = req.body ?? {};

  if (!/^\d{14}$/.test(String(cnpj ?? ""))) {
    return res.status(400).json({ error: "CNPJ invalido" });
  }
  if (!UF_CODES[uf]) {
    return res.status(400).json({ error: "UF invalida" });
  }

  try {
    const envelope = buildEnvelope({ cnpj, uf, ambiente, ultNSU });
    const raw = await callSefaz(envelope, ambiente);

    const cStat = tag(raw, "cStat");
    const xMotivo = tag(raw, "xMotivo");
    const retUltNSU = Number(tag(raw, "ultNSU") ?? ultNSU);
    const maxNSU = Number(tag(raw, "maxNSU") ?? retUltNSU);

    // 137 = nenhum documento localizado, 656 = consumo indevido (aguarde 1h)
    return res.json({
      cStat,
      xMotivo,
      ultNSU: retUltNSU,
      maxNSU,
      docs: cStat === "138" ? parseDocs(raw) : [],
    });
  } catch (error) {
    console.error("[bridge] falha na distribuicao:", error);
    return res.status(502).json({ error: error instanceof Error ? error.message : "Falha na SEFAZ" });
  }
});

app.listen(PORT, () => console.log(`[bridge] ouvindo na porta ${PORT}`));