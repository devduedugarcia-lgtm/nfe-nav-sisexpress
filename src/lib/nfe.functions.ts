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

export const searchSefaz = createServerFn({ method: "POST" })
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
        invoices.map((invoice) => ({ ...invoice, user_id: userId })),
        { onConflict: "user_id,access_key", ignoreDuplicates: true },
      )
      .select("id");

    if (error) throw new Error(error.message);
    return { imported: inserted?.length ?? 0 };
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
    if (!rows || rows.length === 0) return { base64: null, count: 0 };

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
