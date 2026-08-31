export interface NFCeResumida {
  chaveAcesso: string;
  dataEmissao: string;
  valor: number;
  situacao: "Autorizada" | "Cancelada" | "Denegada" | "Inutilizada";
  numero?: string;
  serie?: string;
}

export interface BuscaNFCeFiltro {
  cnpj: string;
  dataInicio: string;
  dataFim: string;
}

export interface BuscaNFCeResposta {
  sucesso: boolean;
  notas: NFCeResumida[];
  mensagem?: string;
}
