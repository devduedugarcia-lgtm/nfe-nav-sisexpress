// Ponte SEFAZ: recebe pedidos autenticados do app e consulta o webservice
// NFeDistribuicaoDFe usando TLS mutuo com o certificado digital A1.
//
// MODO DINAMICO (padrao): cada chamada traz o certificado do usuario
// (pfxBase64 + certPassword). O servico nao grava nada — monta a conexao mTLS
// apenas para aquela consulta. Um mesmo servico atende quantas empresas
// forem necessarias.
//
// MODO FALLBACK (opcional, para testes): defina CERT_PFX_BASE64/CERT_PFX_PATH
// + CERT_PASSWORD e chamadas sem certificado no corpo usam esse certificado.
//
// Este servico NAO faz parte do build do app. Hospede-o separadamente (Render,
// Railway, Fly.io ou VPS) — veja o README desta pasta.

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import https from "node:https";
import tls from "node:tls";
import express from "express";
import forge from "node-forge";

const PORT = process.env.PORT || 8787;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
const CERT_PFX_PATH = process.env.CERT_PFX_PATH;
const CERT_PFX_BASE64 = process.env.CERT_PFX_BASE64;
const CERT_PASSWORD = process.env.CERT_PASSWORD;

if (!BRIDGE_TOKEN) throw new Error("BRIDGE_TOKEN nao configurado");

/** Explica erros comuns de certificado em linguagem util. */
function describeCertError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  if (/too long|header too long|not enough data|wrong tag|DER|asn1|decode/i.test(raw)) {
    return "Certificado invalido: o conteudo enviado nao e um arquivo .pfx/.p12 valido (base64 truncado ou arquivo errado).";
  }
  if (/mac verify failure|incorrect password|decrypt|password/i.test(raw)) {
    return "Senha do certificado incorreta.";
  }
  return `Falha ao ler o certificado: ${raw}`;
}

// ---------------------------------------------------------------------------
// Certificado de fallback via ambiente (opcional, usado so em testes)
// ---------------------------------------------------------------------------
let envCertStatus = { loaded: false, message: "Nenhum certificado de teste configurado (opcional)." };
let envPfx = null;
if ((CERT_PFX_PATH || CERT_PFX_BASE64) && CERT_PASSWORD) {
  try {
    envPfx = CERT_PFX_BASE64
      ? Buffer.from(CERT_PFX_BASE64.replace(/\s+/g, ""), "base64")
      : readFileSync(CERT_PFX_PATH);
    tls.createSecureContext({ pfx: envPfx, passphrase: CERT_PASSWORD });
    envCertStatus = { loaded: true, message: "Certificado de teste carregado do ambiente." };
  } catch (error) {
    envCertStatus = { loaded: false, message: describeCertError(error) };
    console.error("[bridge]", envCertStatus.message);
    envPfx = null;
  }
}

// ---------------------------------------------------------------------------
// Agentes mTLS por certificado, com cache curto em memoria
// ---------------------------------------------------------------------------
const AGENT_TTL_MS = 10 * 60 * 1000;
const AGENT_CACHE_MAX = 100;
const agentCache = new Map(); // key: sha256(pfx) -> { agent, expiresAt }

function agentFor(pfx, passphrase) {
  const key = createHash("sha256").update(pfx).digest("hex");
  const now = Date.now();
  const cached = agentCache.get(key);
  if (cached && cached.expiresAt > now) return cached.agent;

  if (agentCache.size >= AGENT_CACHE_MAX) {
    // Evicao simples: remove os expirados; se ainda estiver cheio, remove o mais antigo.
    for (const [k, v] of agentCache) if (v.expiresAt <= now) agentCache.delete(k);
    if (agentCache.size >= AGENT_CACHE_MAX) {
      const oldest = agentCache.keys().next().value;
      if (oldest) agentCache.delete(oldest);
    }
  }

  const agent = new https.Agent({
    pfx,
    passphrase,
    keepAlive: true,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
  agentCache.set(key, { agent, expiresAt: now + AGENT_TTL_MS });
  return agent;
}

/** Le titular, CNPJ e validade de um .pfx usando node-forge (sem gravar nada). */
function inspectCertificate(pfx, passphrase) {
  const der = forge.util.createBuffer(pfx.toString("binary"));
  const asn1 = forge.asn1.fromDer(der);
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase);
  } catch (error) {
    throw new Error(describeCertError(error));
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert = (bags[forge.pki.oids.certBag] ?? [])[0]?.cert;
  if (!cert) throw new Error("O arquivo nao contem um certificado.");

  const subject = cert.subject.attributes.map((a) => `${a.shortName ?? a.name}=${a.value}`).join(", ");
  const cnpjMatch = subject.match(/\d{14}/);
  const thumbprint = forge.md.sha1
    .create()
    .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
    .digest()
    .toHex();

  return {
    subject,
    cnpj: cnpjMatch ? cnpjMatch[0] : null,
    validFrom: cert.validity.notBefore.toISOString(),
    validUntil: cert.validity.notAfter.toISOString(),
    thumbprint,
  };
}

const ENDPOINTS = {
  producao: "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  homologacao: "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
};

// SAE-NFC-e (SEFAZ-SP): listagem de chaves e download do XML da NFC-e.
const NFCE_ENDPOINTS = {
  producao: {
    chaves: "https://nfce.fazenda.sp.gov.br/ws/NFCeListagemChaves.asmx",
    xml: "https://nfce.fazenda.sp.gov.br/ws/NFCeDownloadXML.asmx",
  },
  homologacao: {
    chaves: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFCeListagemChaves.asmx",
    xml: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFCeDownloadXML.asmx",
  },
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

async function callSefaz(body, ambiente, agent, endpoint) {
  const url = endpoint ?? ENDPOINTS[ambiente] ?? ENDPOINTS.homologacao;
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
app.use(express.json({ limit: "8mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const header = req.headers.authorization ?? "";
  if (header !== `Bearer ${BRIDGE_TOKEN}`) {
    return res.status(401).json({ error: "Nao autorizado" });
  }
  return next();
});

app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    mode: envPfx ? "fallback-env" : "dinamico",
    certLoaded: envCertStatus.loaded,
    message: envPfx
      ? envCertStatus.message
      : "Servico no ar. Certificados sao recebidos por chamada (modo dinamico).",
  }),
);

/** Valida um par arquivo+senha e devolve os dados do titular. Nao grava nada. */
app.post("/validar", (req, res) => {
  const { pfxBase64, certPassword } = req.body ?? {};
  if (!pfxBase64 || typeof pfxBase64 !== "string") {
    return res.status(400).json({ error: "Arquivo do certificado nao informado." });
  }
  if (!certPassword || typeof certPassword !== "string") {
    return res.status(400).json({ error: "Senha do certificado nao informada." });
  }

  const pfx = Buffer.from(String(pfxBase64).replace(/\s+/g, ""), "base64");
  try {
    const info = inspectCertificate(pfx, certPassword);
    // Confirma que o Node tambem aceita o par (mesma validacao usada na conexao mTLS).
    tls.createSecureContext({ pfx, passphrase: certPassword });
    return res.json(info);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const friendly = /incorreta|invalido|Falha ao ler/i.test(raw) ? raw : describeCertError(error);
    return res.status(400).json({ error: friendly });
  }
});

app.post("/distribuicao", async (req, res) => {
  const { cnpj, uf, ambiente = "homologacao", ultNSU = 0, pfxBase64, certPassword } = req.body ?? {};

  if (!/^\d{14}$/.test(String(cnpj ?? ""))) {
    return res.status(400).json({ error: "CNPJ invalido" });
  }
  if (!UF_CODES[uf]) {
    return res.status(400).json({ error: "UF invalida" });
  }

  // Certificado da chamada (dinamico) ou o de fallback do ambiente (testes).
  let pfx = null;
  let passphrase = CERT_PASSWORD;
  if (pfxBase64) {
    if (!certPassword) {
      return res.status(400).json({ error: "Senha do certificado nao informada." });
    }
    pfx = Buffer.from(String(pfxBase64).replace(/\s+/g, ""), "base64");
    passphrase = certPassword;
  } else if (envPfx) {
    pfx = envPfx;
  }

  if (!pfx) {
    return res
      .status(400)
      .json({ error: "Nenhum certificado informado na chamada e nenhum de teste configurado." });
  }

  try {
    const agent = agentFor(pfx, passphrase);
    const envelope = buildEnvelope({ cnpj, uf, ambiente, ultNSU });
    const raw = await callSefaz(envelope, ambiente, agent);

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
    const raw = error instanceof Error ? error.message : "Falha na SEFAZ";
    const friendly = /too long|mac verify failure|header too long|wrong tag|unable to load/i.test(raw)
      ? describeCertError(error)
      : raw;
    return res.status(502).json({ error: friendly });
  }
});

app.listen(PORT, () => console.log(`[bridge] ouvindo na porta ${PORT}`));
