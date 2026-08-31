import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Certificado } from "@/types/certificado";

// Criptografia simples — em produção use chave mais segura
const criptografar = (texto: string): string => btoa(texto);
const descriptografar = (codificado: string): string => atob(codificado);

// Converter arquivo para Base64
const arquivoParaBase64 = (arquivo: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = leitor.result as string;
      resolve(resultado.split(",")[1]); // Remove cabeçalho data:application/...;base64,
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
};

export const useCertificados = () => {
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Carregar todos os certificados do usuário
  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("certificados")
      .select("id, cnpj, razao_social, data_validade, created_at")
      .order("razao_social");

    if (!error) setCertificados(data || []);
    setCarregando(false);
  };

  // Cadastrar novo certificado
  const cadastrar = async (dados: {
    cnpj: string;
    razao_social: string;
    arquivo: File;
    senha: string;
    validade?: string;
  }) => {
    const pfxBase64 = await arquivoParaBase64(dados.arquivo);
    const senhaCript = criptografar(dados.senha);

    const { error } = await supabase.from("certificados").insert({
      cnpj: dados.cnpj.replace(/\D/g, ""),
      razao_social: dados.razao_social,
      certificado_pfx: pfxBase64,
      senha_criptografada: senhaCript,
      data_validade: dados.validade,
    });

    if (error) throw new Error(error.message);
    await carregar();
  };

  // Excluir certificado
  const excluir = async (id: string) => {
    const { error } = await supabase.from("certificados").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await carregar();
  };

  // Obter dados completos (pfx + senha) para envio à SEFAZ
  const obterParaBusca = async (id: string) => {
    const { data, error } = await supabase
      .from("certificados")
      .select("cnpj, certificado_pfx, senha_criptografada")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    return {
      cnpj: data.cnpj,
      certificado_pfx: data.certificado_pfx,
      senha: descriptografar(data.senha_criptografada),
    };
  };

  useEffect(() => { carregar(); }, []);

  return { certificados, carregando, carregar, cadastrar, excluir, obterParaBusca };
};