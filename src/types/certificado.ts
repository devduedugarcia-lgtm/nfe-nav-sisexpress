export interface Certificado {
  id: string;
  cnpj: string;
  razao_social: string;
  certificado_pfx?: string;
  senha_criptografada?: string;
  data_validade?: string;
  created_at?: string;
}

export interface CertificadoForm {
  cnpj: string;
  razao_social: string;
  arquivo_pfx: File;
  senha: string;
  data_validade?: string;
}