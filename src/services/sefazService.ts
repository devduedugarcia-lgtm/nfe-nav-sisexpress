import { BuscaNFCeFiltro, BuscaNFCeResposta } from "@/types/nfe";

export const sefazService = {
  async buscarNFCePorCNPJ(filtro: BuscaNFCeFiltro): Promise<BuscaNFCeResposta> {
    const resposta = await fetch("/api/sefaz/nfce-sp/buscar-por-cnpj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filtro)
    });

    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro na busca");
    return dados;
  },

  baixarXMLPorChave(chaveAcesso: string) {
    window.open(`/api/sefaz/nfce-sp/download-xml?chave=${encodeURIComponent(chaveAcesso)}`, "_blank");
  }
};
