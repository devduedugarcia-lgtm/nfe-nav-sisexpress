import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filterSchema = z.object({
  from: z.string().min(4),
  to: z.string().min(4),
  docType: z.enum(["all", "NFe", "NFCe"]).default("all"),
  direction: z.enum(["all", "entrada", "saida"]).default("all"),
  search: z.string().max(120).default(""),
  source: z.enum(["all", "demo", "sefaz"]).default("all"),
  environment: z.enum(["all", "producao", "homologacao"]).default("all"),
});

type InvoiceFilters = z.infer<typeof filterSchema>;

function applyInvoiceFilters<T extends { eq: any; or: any }>(query: T, data: InvoiceFilters): T {
  let next: any = query;
  if (data.docType !== "all") next = next.eq("doc_type", data.docType);
  if (data.direction !== "all") next = next.eq("direction", data.direction);
  if (data.source !== "all") next = next.eq("source", data.source);
  if (data.source === "sefaz" && data.environment !== "all") {
    next = next.eq("environment", data.environment);
  }
  if (data.search.trim()) {
    const term = `%${data.search.trim()}%`;
    next = next.or(
      `issuer_name.ilike.${term},recipient_name.ilike.${term},number.ilike.${term},access_key.ilike.${term}`,
    );
  }
  return next as T;
}

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, status, created_at").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    return {
      userId,
      profile: profile ?? null,
      isAdmin: (roles ?? []).some((row) => row.role === "admin"),
    };
  });

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .gte("issued_at", new Date(`${data.from}T00:00:00.000Z`).toISOString())
      .lte("issued_at", new Date(`${data.to}T23:59:59.999Z`).toISOString())
      .order("issued_at", { ascending: false });

    query = applyInvoiceFilters(query, data);

    const { data: rows, error } = await query.limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const searchSefazDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { generateMockInvoices } = await import("./nfe.server");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    const invoices = generateMockInvoices({
      from: data.from,
      to: data.to,
      count: 12,
      ownerName: profile?.full_name || profile?.email || "Minha Empresa Ltda",
      ownerCnpj: "11222333000181",
      seed: Date.now() % 2147483647,
    });

    const { data: inserted, error } = await supabase
      .from("invoices")
      .upsert(
        invoices.map((invoice) => ({ ...invoice, user_id: userId, source: "demo" })),
        { onConflict: "user_id,access_key", ignoreDuplicates: true },
      )
      .select("id");

    if (error) throw new Error(error.message);
    return { imported: inserted?.length ?? 0 };
  });

export const getSefazAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { bridgeConfig } = await import("./sefaz.server");
    const { data } = await supabase
      .from("sefaz_accounts")
      .select("cnpj, uf, environment, ult_nsu, last_sync_at, last_status, blocked_until")
      .eq("user_id", userId)
      .maybeSingle();

    return { account: data ?? null, bridgeConfigured: bridgeConfig().configured };
  });

export const saveSefazAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cnpj: z
          .string()
          .transform((value) => value.replace(/\D/g, ""))
          .refine((value) => value.length === 14, "Informe um CNPJ com 14 dígitos"),
        uf: z
          .string()
          .transform((value) => value.toUpperCase())
          .refine((value) => /^[A-Z]{2}$/.test(value), "UF inválida"),
        environment: z.enum(["producao", "homologacao"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("sefaz_accounts").upsert(
      {
        user_id: userId,
        cnpj: data.cnpj,
        uf: data.uf,
        environment: data.environment,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSefazCursor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sefaz_accounts")
      .update({ ult_nsu: 0, last_status: null, blocked_until: null })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearSefazBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sefaz_accounts")
      .update({ blocked_until: null })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testSefazBridge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { checkBridgeHealth } = await import("./sefaz.server");
    return checkBridgeHealth();
  });

export const syncSefaz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { callBridge, parseSefazDocument, describeSefazStatus } = await import("./sefaz.server");
    const { decryptSecret } = await import("./crypto.server");

    const { data: account } = await supabase
      .from("sefaz_accounts")
      .select("cnpj, uf, environment, ult_nsu, blocked_until")
      .eq("user_id", userId)
      .maybeSingle();

    if (!account) {
      throw new Error("Cadastre o CNPJ e a UF na configuração fiscal antes de sincronizar.");
    }

    // A SEFAZ exige intervalo mínimo entre consultas; ignorar isso gera o erro 656.
    if (account.blocked_until && new Date(account.blocked_until) > new Date()) {
      const libera = new Date(account.blocked_until).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
      throw new Error(
        `A SEFAZ exige um intervalo entre consultas. Próxima sincronização liberada às ${libera}.`,
      );
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cert } = await supabaseAdmin
      .from("certificates")
      .select("pfx_ciphertext, password_ciphertext, valid_until, holder_cnpj")
      .eq("user_id", userId)
      .maybeSingle();

    if (!cert?.pfx_ciphertext || !cert.password_ciphertext) {
      throw new Error(
        "Envie seu certificado digital (.pfx ou .p12) na tela Certificado antes de consultar o SEFAZ.",
      );
    }
    if (new Date(`${cert.valid_until}T23:59:59`) < new Date()) {
      throw new Error(
        `Certificado digital vencido em ${cert.valid_until}. Envie um certificado válido para consultar o SEFAZ.`,
      );
    }

    const pfxBase64 = await decryptSecret(cert.pfx_ciphertext);
    const certPassword = await decryptSecret(cert.password_ciphertext);

    const MAX_PAGES = 5;
    const ONE_HOUR = 60 * 60 * 1000;
    const FIVE_MINUTES = 5 * 60 * 1000;
    let cursor = Number(account.ult_nsu ?? 0);
    let maxNSU = cursor;
    let imported = 0;
    let received = 0;
    let parsedCount = 0;
    let status = "Sem retorno da SEFAZ";
    let blockedUntil: string | null = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await callBridge({
        cnpj: account.cnpj,
        uf: account.uf,
        ambiente: account.environment,
        ultNSU: cursor,
        pfxBase64,
        certPassword,
      });

      status = describeSefazStatus(result);
      maxNSU = Math.max(maxNSU, result.maxNSU || 0);

      const code = result.cStat ?? "";
      // 656 = consumo indevido (bloqueio exigido pela SEFAZ, 1h).
      // 137 = nada novo: espera curta, apenas para não repetir consultas em rajada.
      if (code === "656") blockedUntil = new Date(Date.now() + ONE_HOUR).toISOString();
      else if (code === "137") blockedUntil = new Date(Date.now() + FIVE_MINUTES).toISOString();

      received += result.docs.length;

      const parsed = result.docs
        .map((doc) => parseSefazDocument(doc, account.cnpj))
        .filter((invoice): invoice is NonNullable<typeof invoice> => invoice !== null);
      parsedCount += parsed.length;

      // Grava as notas ANTES de avançar o cursor: se a gravação falhar, o cursor
      // fica onde está e os documentos voltam na próxima consulta.
      if (parsed.length > 0) {
        const { data: inserted, error } = await supabase
          .from("invoices")
          .upsert(
            parsed.map((invoice) => ({
              ...invoice,
              user_id: userId,
              environment: account.environment,
            })),
            { onConflict: "user_id,access_key", ignoreDuplicates: true },
          )
          .select("id");
        if (error) throw new Error(error.message);
        imported += inserted?.length ?? 0;
      }

      const nextCursor = Math.max(cursor, result.ultNSU || 0);
      const advanced = nextCursor > cursor;
      cursor = nextCursor;

      await supabase
        .from("sefaz_accounts")
        .update({
          ult_nsu: cursor,
          last_sync_at: new Date().toISOString(),
          last_status: status,
          blocked_until: blockedUntil,
        })
        .eq("user_id", userId);

      // Só continua a paginação quando a SEFAZ devolveu documentos (138) e o NSU avançou.
      if (blockedUntil || code !== "138" || !advanced || result.docs.length === 0) break;
      if (cursor >= maxNSU) break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const nextNsu = cursor;
    const highest = Math.max(maxNSU, nextNsu);
    const skipped = Math.max(received - parsedCount, 0);

    return {
      imported,
      received,
      parsed: parsedCount,
      skipped,
      status,
      ultNSU: nextNsu,
      maxNSU: highest,
      pending: Math.max(highest - nextNsu, 0),
      blockedUntil,
    };
  });

export const getInvoiceXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("invoices")
      .select("access_key, number, doc_type, xml_content")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Nota não encontrada");
    return { fileName: `${row.doc_type}-${row.number}-${row.access_key}.xml`, xml: row.xml_content };
  });

export const exportInvoicesZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { buildZipBase64 } = await import("./nfe.server");

    let query = supabase
      .from("invoices")
      .select("access_key, number, doc_type, direction, issued_at, xml_content")
      .eq("user_id", userId)
      .gte("issued_at", new Date(`${data.from}T00:00:00.000Z`).toISOString())
      .lte("issued_at", new Date(`${data.to}T23:59:59.999Z`).toISOString());

    query = applyInvoiceFilters(query, data);

    const { data: rows, error } = await query.limit(500);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { base64: null, count: 0, inbound: 0, outbound: 0 };

    const base64 = buildZipBase64(
      rows.map((row) => ({
        name: `${row.direction === "entrada" ? "entradas" : "saidas"}/${row.doc_type}-${row.number}-${row.access_key}.xml`,
        content: row.xml_content,
      })),
    );

    const inbound = rows.filter((row) => row.direction === "entrada").length;

    return { base64, count: rows.length, inbound, outbound: rows.length - inbound };
  });

export const clearInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("invoices").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCertificate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("certificates")
      .select(
        "file_name, valid_until, valid_from, uploaded_at, subject_name, holder_cnpj, thumbprint, status",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return null;

    const expired = new Date(`${data.valid_until}T23:59:59`) < new Date();
    const daysLeft = Math.ceil(
      (new Date(`${data.valid_until}T23:59:59`).getTime() - Date.now()) / 86_400_000,
    );

    return { ...data, expired, daysLeft };
  });

export const uploadCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fileName: z
          .string()
          .trim()
          .min(3)
          .max(160)
          .refine((value) => /\.(pfx|p12)$/i.test(value), "O arquivo deve ser .pfx ou .p12"),
        password: z.string().min(4).max(120),
        fileBase64: z
          .string()
          .min(100, "Arquivo vazio ou inválido")
          .max(4_000_000, "Arquivo muito grande para um certificado A1"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { validateCertificateOnBridge } = await import("./sefaz.server");
    const { encryptSecret, sha256Base64 } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pfxBase64 = data.fileBase64.replace(/\s+/g, "");
    const info = await validateCertificateOnBridge({ pfxBase64, certPassword: data.password });

    const validUntil = info.validUntil ? info.validUntil.slice(0, 10) : null;
    if (!validUntil) {
      throw new Error("Não foi possível ler a validade do certificado.");
    }
    const expired = new Date(`${validUntil}T23:59:59`) < new Date();

    // Colunas cifradas são revogadas para o papel do app; a gravação usa o cliente
    // administrativo no servidor, sempre restrita à linha do usuário autenticado.
    const { error } = await supabaseAdmin.from("certificates").upsert(
      {
        user_id: userId,
        file_name: data.fileName,
        valid_until: validUntil,
        valid_from: info.validFrom ? info.validFrom.slice(0, 10) : null,
        uploaded_at: new Date().toISOString(),
        subject_name: info.subject,
        holder_cnpj: info.cnpj,
        thumbprint: info.thumbprint ?? (await sha256Base64(pfxBase64)),
        status: expired ? "expirado" : "valido",
        pfx_ciphertext: await encryptSecret(pfxBase64),
        password_ciphertext: await encryptSecret(data.password),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
    return {
      fileName: data.fileName,
      validUntil,
      subject: info.subject,
      cnpj: info.cnpj,
      expired,
    };
  });

export const deleteCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("certificates").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, status, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);

    const roleMap = new Map((roles ?? []).map((row) => [row.user_id, row.role]));
    return (profiles ?? []).map((profile) => ({ ...profile, role: roleMap.get(profile.id) ?? "user" }));
  });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["approved", "rejected", "pending"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");
    if (data.userId === userId) throw new Error("Não é possível alterar o status da própria conta");

    const { error } = await supabase.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
