# Ponte SEFAZ (serviço Node.js)

O webservice `NFeDistribuicaoDFe` da SEFAZ exige SOAP com **TLS mútuo** usando o
certificado digital A1 da empresa. O backend do app (runtime edge) não faz TLS
mútuo, então este serviço fica entre os dois:

```text
app (Lovable) --HTTPS + token + certificado cifrado--> ponte (Node.js) --SOAP + mTLS--> SEFAZ
```

## Como funciona (modo dinâmico, padrão)

Cada usuário envia o próprio certificado pela tela do app. O app guarda o
arquivo e a senha **cifrados** no banco e, a cada sincronização, envia o
certificado para este serviço **somente naquela chamada**. O serviço monta a
conexão mTLS em memória, consulta a SEFAZ e descarta tudo — nada é gravado em
disco. Um mesmo serviço atende quantas empresas forem necessárias, sem nenhuma
configuração manual por certificado.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `BRIDGE_TOKEN` | sim | Token compartilhado com o app (use uma string longa e aleatória) |
| `PORT` | não | Porta HTTP (padrão `8787`) |
| `CERT_PFX_BASE64` | não | Certificado de teste em base64 (fallback para chamadas sem certificado) |
| `CERT_PFX_PATH` | não | Caminho de um `.pfx` de teste (alternativa ao base64) |
| `CERT_PASSWORD` | não | Senha do certificado de teste |
| `NODE_EXTRA_CA_CERTS` | não | CA extra, se a SEFAZ do seu estado exigir |

Em produção, **basta o `BRIDGE_TOKEN`**. As variáveis de certificado servem só
para testar o serviço isoladamente (`curl`) e podem ser removidas depois.

## Rodar localmente

```bash
cd sefaz-bridge
npm install
BRIDGE_TOKEN=troque-isto npm start
```

Teste: `curl http://localhost:8787/health`

## Deploy

**Render / Railway**
1. Novo Web Service apontando para este repositório, diretório raiz `sefaz-bridge`.
2. Build: `npm install` · Start: `npm start`.
3. Cadastre apenas `BRIDGE_TOKEN` (e, se quiser testar via curl, as variáveis
   de certificado de teste).

**Fly.io**
```bash
cd sefaz-bridge
fly launch --no-deploy
fly secrets set BRIDGE_TOKEN=...
fly deploy
```

**VPS (systemd)**: `node server.mjs` atrás de Nginx com HTTPS; o app só aceita
URL `https://`.

## Endpoints

### `POST /validar` — cabeçalho `Authorization: Bearer <BRIDGE_TOKEN>`

Valida o par arquivo + senha e devolve os dados do titular (sem gravar nada).
Usado pelo app no momento do envio do certificado.

```json
{ "pfxBase64": "MII...", "certPassword": "senha" }
```

Resposta:

```json
{
  "subject": "CN=EMPRESA LTDA:11222333000181, ...",
  "cnpj": "11222333000181",
  "validFrom": "2025-01-10T12:00:00.000Z",
  "validUntil": "2026-01-10T12:00:00.000Z",
  "thumbprint": "ab12cd..."
}
```

### `POST /distribuicao` — cabeçalho `Authorization: Bearer <BRIDGE_TOKEN>`

```json
{
  "cnpj": "11222333000181",
  "uf": "SP",
  "ambiente": "homologacao",
  "ultNSU": 0,
  "pfxBase64": "MII...",
  "certPassword": "senha"
}
```

`pfxBase64`/`certPassword` são opcionais apenas quando existe um certificado
de teste configurado no ambiente.

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
