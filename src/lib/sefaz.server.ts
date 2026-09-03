// Helpers server-only: chamada da ponte Node.js e leitura dos XMLs da SEFAZ.
import { createHash } from "node:crypto";


export type BridgeDoc = { nsu: number; schema: string; xml: string };

export type BridgeResponse = {
  cStat: string | null;
  xMotivo: string | null;
  ultNSU: number;
  maxNSU: number;
  docs: BridgeDoc[];
};

export type ParsedInvoice = {
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
  source: string;
  nsu: number;
  schema_type: string;
};

export function bridgeConfig() {
  const configuredUrl = process.env["SEFAZ_BRIDGE_URL"]?.trim().replace(/\/+$/, "");
  // Compatibilidade com o endereço anterior: o segredo pode continuar apontando
  // para ele até ser atualizado no cofre, mas o app já usa a ponte publicada.
  const url = configuredUrl?.includes("sefaz-bridge-a33m.onrender.com")
    ? "https://nfe-nav-sisexpress-3.onrender.com"
    : configuredUrl;
  const token = process.env["SEFAZ_BRIDGE_TOKEN"]?.trim();
  return { url: url ?? null, token: token ?? null, configured: Boolean(url && token) };

}

export type BridgeHealth = {
  ok: boolean;
  message: string;
  certificate?: { subject?: string | null; validUntil?: string | null } | null;
};

export type CertificateInfo = {
  subject: string | null;
  cnpj: string | null;
  validFrom: string | null;
  validUntil: string | null;
  thumbprint: string | null;
};

const NOT_PUBLISHED =
  "O serviço de consulta não está publicado neste endereço (respondeu 404). Faça o deploy da pasta sefaz-bridge no Render e confira a URL cadastrada.";

/** Traduz falhas HTTP do serviço em mensagens úteis para o usuário. */
function bridgeHttpError(status: number, text: string, fallback: string): string {
  if (status === 404) return NOT_PUBLISHED;
  if (status === 401 || status === 403) {
    const app = bridgeConfig().token;
    const hint = app
      ? ` Impressão do token cadastrado no app: ${createHash("sha256").update(app).digest("hex").slice(0, 8)}.`
      : "";
    return `O serviço recusou o token. Copie o mesmo valor para a variável BRIDGE_TOKEN no Render e para o segredo SEFAZ_BRIDGE_TOKEN no app, e refaça o deploy do serviço.${hint}`;
  }

  if (status === 502 || status === 503 || status === 504) {
    return "O serviço não respondeu a tempo (pode estar iniciando no plano gratuito do Render). Tente novamente em alguns segundos.";
  }
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    /* mantém a mensagem genérica */
  }
  return fallback;
}

/** Erros de rede (serviço fora do ar, DNS, timeout). */
function bridgeNetworkError(error: unknown): string {
  const raw = error instanceof Error && error.message ? error.message : "";
  if (/timeout|timed out|aborted/i.test(raw)) {
    return "O serviço demorou a responder; tente novamente em alguns segundos.";
  }
  return raw
    ? `Não foi possível alcançar o serviço de consulta: ${raw}`
    : "Não foi possível alcançar o serviço de consulta.";
}

/**
 * Valida o par arquivo + senha no serviço (que tem Node/OpenSSL) e devolve os
 * dados do titular. O serviço não grava nada: apenas lê e responde.
 */
export async function validateCertificateOnBridge(input: {
  pfxBase64: string;
  certPassword: string;
}): Promise<CertificateInfo> {
  const { url, token, configured } = bridgeConfig();
  if (!configured) {
    throw new Error(
      "Serviço de consulta não configurado. Cadastre a URL e o token antes de enviar o certificado.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url!.replace(/\/$/, "")}/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token!}` },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new Error(bridgeNetworkError(error));
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      bridgeHttpError(response.status, text, `O serviço respondeu ${response.status}`),
    );
  }

  return JSON.parse(text) as CertificateInfo;
}

/** Consulta o `/health` do serviço publicado e devolve um resumo seguro. */
export async function checkBridgeHealth(): Promise<BridgeHealth> {
  const { url, token, configured } = bridgeConfig();
  if (!configured) {
    return { ok: false, message: "Serviço de consulta ainda não cadastrado (URL e token)." };
  }

  try {
    const response = await fetch(`${url!.replace(/\/$/, "")}/health`, {
      headers: { Authorization: `Bearer ${token!}` },
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        message: bridgeHttpError(
          response.status,
          text,
          `O serviço respondeu ${response.status}. Verifique URL e token.`,
        ),
      };
    }

    let payload: {
      ok?: boolean;
      message?: string;
      certificate?: { subject?: string | null; validUntil?: string | null } | null;
      certLoaded?: boolean;
      certValidUntil?: string | null;
    } = {};
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      return { ok: false, message: "O serviço respondeu em formato inesperado." };
    }

    const certificate =
      payload.certificate ??
      (payload.certLoaded === undefined
        ? null
        : { subject: null, validUntil: payload.certValidUntil ?? null });

    if (payload.ok === false || payload.certLoaded === false) {
      return {
        ok: false,
        message: payload.message ?? "Serviço acessível, mas o certificado digital não foi carregado.",
        certificate,
      };
    }

    return {
      ok: true,
      message: payload.message
        ? `Serviço acessível e token aceito. ${payload.message}`
        : "Serviço acessível e token aceito.",
      certificate,
    };
  } catch (error) {
    return { ok: false, message: bridgeNetworkError(error) };
  }
}

export async function callBridge(input: {
  cnpj: string;
  uf: string;
  ambiente: string;
  ultNSU: number;
  pfxBase64?: string;
  certPassword?: string;
}): Promise<BridgeResponse> {
  const { url, token, configured } = bridgeConfig();
  if (!configured) {
    throw new Error(
      "Integração com o SEFAZ não configurada. Cadastre a URL e o token do serviço de consulta.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url!.replace(/\/$/, "")}/distribuicao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token!}`,
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new Error(bridgeNetworkError(error));
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      bridgeHttpError(
        response.status,
        text,
        `O serviço de consulta respondeu ${response.status}`,
      ),
    );
  }

  return JSON.parse(text) as BridgeResponse;
}

function tagValue(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match?.[1]?.trim() ?? null;
}

function sectionValue(xml: string, section: string, name: string): string | null {
  const block = tagValue(xml, section);
  return block ? tagValue(block, name) : null;
}

function toIsoDate(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/**
 * Lê um documento devolvido pela distribuição da SEFAZ. Cobre `procNFe`
 * (nota completa) e `resNFe` (apenas o resumo, quando a nota ainda não foi
 * manifestada). Retorna null quando o schema não é uma NFe/NFCe.
 */
export function parseSefazDocument(doc: BridgeDoc, ownerCnpj: string): ParsedInvoice | null {
  const xml = doc.xml ?? "";
  if (!xml) return null;

  const isResume = doc.schema.startsWith("resNFe");
  const isFull = doc.schema.startsWith("procNFe") || xml.includes("<infNFe");
  if (!isResume && !isFull) return null;

  const accessKey = (tagValue(xml, "chNFe") ?? tagValue(xml, "Id") ?? "").replace(/\D/g, "").slice(-44);
  if (accessKey.length !== 44) return null;

  const model = accessKey.slice(20, 22);
  const docType = model === "65" ? "NFCe" : "NFe";
  const number = String(Number(accessKey.slice(25, 34)));
  const series = String(Number(accessKey.slice(22, 25))).padStart(3, "0");

  const issuerCnpj = (
    sectionValue(xml, "emit", "CNPJ") ??
    tagValue(xml, "CNPJ") ??
    accessKey.slice(6, 20)
  ).replace(/\D/g, "");
  const issuerName = sectionValue(xml, "emit", "xNome") ?? tagValue(xml, "xNome") ?? "Emitente";
  const recipientCnpj = (sectionValue(xml, "dest", "CNPJ") ?? "").replace(/\D/g, "") || null;
  const recipientName = sectionValue(xml, "dest", "xNome") ?? "Destinatário";

  const issuedAt = toIsoDate(tagValue(xml, "dhEmi") ?? tagValue(xml, "dEmi"));
  const total = Number(tagValue(xml, "vNF") ?? "0");

  const cancelled = /<(cSitNFe|cSitConf)>\s*3\s*</.test(xml) || xml.includes("<retCancNFe");
  const status = cancelled ? "Cancelada" : isResume ? "Resumo" : "Autorizada";

  return {
    access_key: accessKey,
    number,
    series,
    doc_type: docType,
    direction: issuerCnpj === ownerCnpj ? "saida" : "entrada",
    issuer_name: issuerName,
    issuer_cnpj: issuerCnpj,
    recipient_name: recipientName,
    recipient_cnpj: recipientCnpj,
    issued_at: issuedAt,
    total_amount: Number.isFinite(total) ? total : 0,
    status,
    xml_content: xml,
    source: "sefaz",
    nsu: doc.nsu,
    schema_type: doc.schema,
  };
}

export function describeSefazStatus(result: BridgeResponse): string {
  const code = result.cStat ?? "?";
  if (code === "137") return "137 · Nenhum documento novo na SEFAZ";
  if (code === "656") return "656 · Consumo indevido: aguarde 1 hora para consultar novamente";
  if (code === "138") return "138 · Documentos localizados";
  return `${code} · ${result.xMotivo ?? "Retorno da SEFAZ"}`;
}

// ---------------------------------------------------------------------------
// SAE-NFC-e (SEFAZ-SP)
// ---------------------------------------------------------------------------

export type NfceKeysResponse = {
  cStat: string | null;
  xMotivo: string | null;
  dhEmisUltNfce: string | null;
  chaves: string[];
};

export type NfceXmlResponse = {
  cStat: string | null;
  xMotivo: string | null;
  chNFCe: string;
  xml: string | null;
  eventos: string[];
};

type NfceCert = { pfxBase64: string; certPassword: string };

async function postBridge<T>(path: string, payload: unknown): Promise<T> {
  const { url, token, configured } = bridgeConfig();
  if (!configured) {
    throw new Error(
      "Integração com o SEFAZ não configurada. Cadastre a URL e o token do serviço de consulta.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url!.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token!}` },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(bridgeNetworkError(error));
  }

  const text = await response.text();
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "O serviço publicado não respondeu aos endpoints da NFC-e (404). Faça o deploy da nova versão da pasta sefaz-bridge no Render.",
      );
    }
    throw new Error(
      bridgeHttpError(
        response.status,
        text,
        `O serviço de consulta respondeu ${response.status}`,
      ),
    );
  }

  return JSON.parse(text) as T;
}

/** `NFCeListagemChaves`: chaves emitidas no período (máx. 2000 por chamada). */
export function listNfceKeys(
  input: { ambiente: string; dataHoraInicial: string; dataHoraFinal: string } & NfceCert,
): Promise<NfceKeysResponse> {
  return postBridge<NfceKeysResponse>("/nfce/chaves", input);
}

/** `NFCeDownloadXML`: XML completo (`nfeProc`) de uma chave. */
export function downloadNfceXml(
  input: { ambiente: string; chNFCe: string } & NfceCert,
): Promise<NfceXmlResponse> {
  return postBridge<NfceXmlResponse>("/nfce/xml", input);
}

/**
 * Interpreta o retorno do download da NFC-e. O XML vem como `nfeProc`, então o
 * parser da distribuição é reaproveitado com o schema equivalente.
 */
export function parseNfceDocument(
  doc: { chNFCe: string; xml: string },
  ownerCnpj: string,
): ParsedInvoice | null {
  const parsed = parseSefazDocument(
    { nsu: 0, schema: "procNFe_v4.00.xsd", xml: doc.xml },
    ownerCnpj,
  );
  if (!parsed) return null;
  return {
    ...parsed,
    access_key: doc.chNFCe,
    doc_type: "NFCe",
    direction: "saida",
    schema_type: "nfceDownloadXML",
    nsu: 0,
  };
}

export function describeNfceStatus(cStat: string | null, xMotivo: string | null): string {
  const code = cStat ?? "?";
  const map: Record<string, string> = {
    "100": "Autorizado o uso da NFC-e",
    "101": "Lista incompleta: continuando pelo último horário retornado",
    "107": "Nenhuma NFC-e encontrada no período",
    "104": "Consulta fora do prazo de 100 dias",
    "108": "Serviço da SEFAZ paralisado momentaneamente",
    "109": "Serviço da SEFAZ paralisado sem previsão",
    "200": "Consulta processada com sucesso",
    "203": "Chave pertence a outro CNPJ",
    "204": "Chave inválida",
    "205": "NFC-e não encontrada",
    "207": "Consulta fora do prazo permitido",
    "282": "Certificado digital do emitente inválido",
    "285": "Certificado digital sem permissão para o serviço",
    "656": "Consumo indevido: aguarde 1 hora para consultar novamente",
  };
  return `${code} · ${map[code] ?? xMotivo ?? "Retorno da SEFAZ"}`;
}