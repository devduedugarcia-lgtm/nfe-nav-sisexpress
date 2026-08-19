import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filterSchema = z.object({
  from: z.string().min(4),
  to: z.string().min(4),
  docType: z.enum(["all", "NFe", "NFCe"]).default("all"),
  direction: z.enum(["all", "entrada", "saida"]).default("all"),
  search: z.string().max(120).default(""),
});

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

    if (data.docType !== "all") query = query.eq("doc_type", data.docType);
    if (data.direction !== "all") query = query.eq("direction", data.direction);
    if (data.search.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(
        `issuer_name.ilike.${term},recipient_name.ilike.${term},number.ilike.${term},access_key.ilike.${term}`,
      );
    }

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
      .select("cnpj, uf, environment, ult_nsu, last_sync_at, last_status")
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
      .update({ ult_nsu: 0, last_status: null })
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

    const { data: account } = await supabase
      .from("sefaz_accounts")
      .select("cnpj, uf, environment, ult_nsu")
      .eq("user_id", userId)
      .maybeSingle();

    if (!account) {
      throw new Error("Cadastre o CNPJ e a UF na configuração fiscal antes de sincronizar.");
    }

    const MAX_PAGES = 5;
    let cursor = Number(account.ult_nsu ?? 0);
    let maxNSU = cursor;
    let imported = 0;
    let status = "Sem retorno da SEFAZ";

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await callBridge({
        cnpj: account.cnpj,
        uf: account.uf,
        ambiente: account.environment,
        ultNSU: cursor,
      });

      status = describeSefazStatus(result);
      maxNSU = Math.max(maxNSU, result.maxNSU || 0);

      const parsed = result.docs
        .map((doc) => parseSefazDocument(doc, account.cnpj))
        .filter((invoice): invoice is NonNullable<typeof invoice> => invoice !== null);

      if (parsed.length > 0) {
        const { data: inserted, error } = await supabase
          .from("invoices")
          .upsert(
            parsed.map((invoice) => ({ ...invoice, user_id: userId })),
            { onConflict: "user_id,access_key", ignoreDuplicates: true },
          )
          .select("id");
        if (error) throw new Error(error.message);
        imported += inserted?.length ?? 0;
      }

      const nextCursor = Math.max(cursor, result.ultNSU || 0);
      const advanced = nextCursor > cursor;
      cursor = nextCursor;

      // Grava o cursor a cada página para não reprocessar em caso de falha adiante.
      await supabase
        .from("sefaz_accounts")
        .update({ ult_nsu: cursor, last_sync_at: new Date().toISOString(), last_status: status })
        .eq("user_id", userId);

      if (!advanced || result.docs.length === 0 || cursor >= maxNSU) break;
    }

    const nextNsu = cursor;

    return {
      imported,
      status,
      ultNSU: nextNsu,
      maxNSU: result.maxNSU || nextNsu,
      pending: Math.max((result.maxNSU || nextNsu) - nextNsu, 0),
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

    if (data.docType !== "all") query = query.eq("doc_type", data.docType);
    if (data.direction !== "all") query = query.eq("direction", data.direction);
    if (data.search.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(
        `issuer_name.ilike.${term},recipient_name.ilike.${term},number.ilike.${term},access_key.ilike.${term}`,
      );
    }

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
      .select("file_name, valid_until, uploaded_at")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Simulated upload: the certificate binary/password are never stored.
    void data.password;
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const { error } = await supabase.from("certificates").upsert(
      {
        user_id: userId,
        file_name: data.fileName,
        valid_until: validUntil.toISOString().slice(0, 10),
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
    return { fileName: data.fileName, validUntil: validUntil.toISOString().slice(0, 10) };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, status, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
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
