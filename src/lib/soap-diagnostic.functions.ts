import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z
  .object({
    context: z.string().trim().max(1_000, "O contexto deve ter no máximo 1.000 caracteres"),
    errorMessage: z.string().trim().max(8_000, "A mensagem deve ter no máximo 8.000 caracteres"),
    requestSoap: z
      .string()
      .trim()
      .max(40_000, "A requisição SOAP deve ter no máximo 40.000 caracteres"),
    responseSoap: z
      .string()
      .trim()
      .max(40_000, "A resposta SOAP deve ter no máximo 40.000 caracteres"),
  })
  .refine(
    (value) => Boolean(value.errorMessage || value.requestSoap || value.responseSoap),
    "Informe uma mensagem de erro, uma requisição SOAP ou uma resposta SOAP",
  );

export type SoapDiagnosticResult = {
  probableCause: string;
  evidence: string[];
  suggestedFixes: string[];
  recommendedChecks: string[];
  confidence: "baixa" | "média" | "alta";
  caveat: string;
  redactionsApplied: number;
};

const LONG_SECRET = /\b[A-Za-z0-9+/=_-]{80,}\b/g;
const PRIVATE_KEY =
  /-----BEGIN [^-]*(?:PRIVATE KEY|CERTIFICATE)[^-]*-----[\s\S]*?-----END [^-]*(?:PRIVATE KEY|CERTIFICATE)[^-]*-----/gi;
const AUTH_HEADER = /(authorization\s*[:=]\s*(?:bearer\s+|basic\s+)?)[^\s<"']+/gi;
const XML_SECRET =
  /(<(?:senha|password|token|certPassword|pfxBase64)[^>]*>)[\s\S]*?(<\/(?:senha|password|token|certPassword|pfxBase64)>)/gi;
const JSON_SECRET =
  /("(?:password|senha|token|authorization|certPassword|pfxBase64)"\s*:\s*")[^"]*(")/gi;
const ACCESS_KEY = /\b\d{44}\b/g;
const CNPJ_CPF =
  /\b(?:\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[-\s]?\d{2}|\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/\s-]?\d{4}[-\s]?\d{2}|\d{11}|\d{14})\b/g;

export function redactSoapDiagnostic(value: string): { text: string; count: number } {
  let count = 0;
  const replace = (pattern: RegExp, replacement: string | ((...args: string[]) => string)) => {
    value = value.replace(pattern, (...args) => {
      count += 1;
      return typeof replacement === "string" ? replacement : replacement(...(args as string[]));
    });
  };

  replace(PRIVATE_KEY, "[CERTIFICADO_REMOVIDO]");
  replace(AUTH_HEADER, (_match, prefix) => `${prefix}[SEGREDO_REMOVIDO]`);
  replace(XML_SECRET, (_match, open, close) => `${open}[SEGREDO_REMOVIDO]${close}`);
  replace(JSON_SECRET, (_match, prefix, suffix) => `${prefix}[SEGREDO_REMOVIDO]${suffix}`);
  replace(LONG_SECRET, "[CONTEUDO_LONGO_REMOVIDO]");
  replace(ACCESS_KEY, "[CHAVE_FISCAL_REMOVIDA]");
  replace(CNPJ_CPF, "[DOCUMENTO_REMOVIDO]");
  return { text: value, count };
}

export const analyzeSoapDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("O Lovable AI ainda não está configurado para este aplicativo.");

    const fields = [data.context, data.errorMessage, data.requestSoap, data.responseSoap].map(
      redactSoapDiagnostic,
    );
    const redactionsApplied = fields.reduce((total, field) => total + field.count, 0);
    const [safeContext, safeError, safeRequest, safeResponse] = fields.map((field) => field.text);

    const { runSoapDiagnostic } = await import("./ai-gateway.server");
    const output = await runSoapDiagnostic({
      apiKey,
      context: safeContext ?? "",
      errorMessage: safeError ?? "",
      requestSoap: safeRequest ?? "",
      responseSoap: safeResponse ?? "",
    });
    return { ...output, redactionsApplied } satisfies SoapDiagnosticResult;
  });
