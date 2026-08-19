# Ponte SEFAZ (serviço Node.js)

O webservice `NFeDistribuicaoDFe` da SEFAZ exige SOAP com **TLS mútuo** usando o
certificado digital A1 da empresa. O backend do app (runtime edge) não faz TLS
mútuo, então este serviço fica entre os dois:

```text
app (Lovable) --HTTPS + token--> ponte (Node.js) --SOAP + mTLS--> SEFAZ
```

O certificado nunca sai daqui.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `BRIDGE_TOKEN` | sim | Token compartilhado com o app (use uma string longa e aleatória) |
| `CERT_PASSWORD` | sim | Senha do certificado A1 |
| `CERT_PFX_BASE64` | sim* | Conteúdo do `.pfx`/`.p12` em base64 (recomendado em PaaS) |
| `CERT_PFX_PATH` | sim* | Caminho do arquivo `.pfx` no disco (alternativa ao base64) |
| `PORT` | não | Porta HTTP (padrão `8787`) |
| `NODE_EXTRA_CA_CERTS` | não | CA extra, se a SEFAZ do seu estado exigir |

\* informe **um** dos dois.

Gerar o base64 do certificado:

```bash
base64 -w0 certificado.pfx    # Linux
base64 -i certificado.pfx     # macOS
```

## Rodar localmente

```bash
cd sefaz-bridge
npm install
BRIDGE_TOKEN=troque-isto \
CERT_PASSWORD=senha-do-certificado \
CERT_PFX_PATH=./certificado.pfx \
npm start
```

Teste: `curl http://localhost:8787/health`

## Deploy

**Render / Railway**
1. Novo Web Service apontando para este repositório, diretório raiz `sefaz-bridge`.
2. Build: `npm install` · Start: `npm start`.
3. Cadastre as variáveis de ambiente acima (use `CERT_PFX_BASE64`).

**Fly.io**
```bash
cd sefaz-bridge
fly launch --no-deploy
fly secrets set BRIDGE_TOKEN=... CERT_PASSWORD=... CERT_PFX_BASE64="$(base64 -w0 certificado.pfx)"
fly deploy
```

**VPS (systemd)**: `node server.mjs` atrás de Nginx com HTTPS; o app só aceita
URL `https://`.

## Endpoint

`POST /distribuicao` — cabeçalho `Authorization: Bearer <BRIDGE_TOKEN>`

```json
{ "cnpj": "11222333000181", "uf": "SP", "ambiente": "homologacao", "ultNSU": 0 }
```

Resposta:

```json
{
  "cStat": "138",
  "xMotivo": "Documento localizado",
  "ultNSU": 1234,
  "maxNSU": 1240,
  "docs": [{ "nsu": 1201, "schema": "procNFe_v4.00.xml", "xml": "<nfeProc>…" }]
}
```

Códigos comuns da SEFAZ: `138` documentos localizados · `137` nenhum documento
novo · `656` consumo indevido (aguarde 1 hora antes de consultar de novo).

## Depois do deploy

Informe a URL pública e o token no app; eles são guardados como segredos
(`SEFAZ_BRIDGE_URL`, `SEFAZ_BRIDGE_TOKEN`) e usados apenas no servidor.