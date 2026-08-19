// Helpers server-only: chamada da ponte Node.js e leitura dos XMLs da SEFAZ.

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
  const url = process.env["SEFAZ_BRIDGE_URL"];
  const token = process.env["SEFAZ_BRIDGE_TOKEN"];
  return { url: url ?? null, token: token ?? null, configured: Boolean(url && token) };
}

export type BridgeHealth = {
  ok: boolean;
  message: string;
  certificate?: { subject?: string | null; validUntil?: string | null } | null;
};

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
      return { ok: false, message: `O serviço respondeu ${response.status}. Verifique URL e token.` };
    }

    let payload: {
      ok?: boolean;
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

    return {
      ok: payload.ok !== false,
      message: "Serviço acessível e token aceito.",
      certificate,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? `Não foi possível alcançar o serviço: ${error.message}`
          : "Não foi possível alcançar o serviço.",
    };
  }
}

export async function callBridge(input: {
  cnpj: string;
  uf: string;
  ambiente: string;
  ultNSU: number;
}): Promise<BridgeResponse> {
  const { url, token, configured } = bridgeConfig();
  if (!configured) {
    throw new Error(
      "Integração com o SEFAZ não configurada. Cadastre a URL e o token do serviço de consulta.",
    );
  }

  const response = await fetch(`${url!.replace(/\/$/, "")}/distribuicao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token!}`,
    },
    body: JSON.stringify(input),
  });

  const text = await response.text();
  if (!response.ok) {
    let message = `O serviço de consulta respondeu ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* mantém a mensagem genérica */
    }
    throw new Error(message);
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