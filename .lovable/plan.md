# Publicar ponte SEFAZ no Render + app Lovable

Você quer publicar os dois serviços e escolheu o **Render** para hospedar a
ponte Node.js. A ordem importa: primeiro a ponte (para termos URL/token), depois
o app (para cadastrar os segredos e testar).

## 1. Publicar a ponte SEFAZ no Render

A ponte é a pasta `sefaz-bridge/` do repositório. Ela NÃO faz parte do build
do app Lovable; é um serviço independente.

Passos:
1. Vá em https://dashboard.render.com e crie um novo **Web Service**.
2. Conecte o mesmo repositório Git deste projeto Lovable.
3. Configure:
   - **Root directory**: `sefaz-bridge` (Render roda o build a partir desta pasta)
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Runtime**: Node
4. Adicione as variáveis de ambiente obrigatórias:
   - `BRIDGE_TOKEN` — crie uma string longa e aleatória (ex.: 64 caracteres)
   - `CERT_PASSWORD` — senha do certificado A1
   - `CERT_PFX_BASE64` — conteúdo do `.pfx`/`.p12` em base64
5. Aguarde o deploy. A URL pública será algo como `https://sefaz-bridge-xxx.onrender.com`.
6. Teste rápido: `curl https://<URL>/health` deve devolver `{ "ok": true }`.

## 2. Guardar URL e token no app Lovable

Depois que a ponte estiver no ar:
1. Você me passa a URL pública e o `BRIDGE_TOKEN`.
2. Eu guardo como segredos do projeto: `SEFAZ_BRIDGE_URL` e `SEFAZ_BRIDGE_TOKEN`.
3. Esses valores nunca aparecem no código nem no navegador — só o backend do
   app usa.

## 3. Publicar o app Lovable

Com a ponte rodando e os segredos salvos:
1. Eu verifico se não há erros críticos de segurança pendentes.
2. Você clica em **Publish** no canto superior direito do editor Lovable.
3. O app fica acessível na URL publicada (já existe: `nfe-nav-sisexpress.lovable.app`).
4. Depois do publish, testamos a conexão real pela tela do app.

## O que preciso de você agora

- Confirme se consegue criar o Web Service no Render com as informações acima.
- Me envie a **URL pública** e o **token** após o deploy.
- Informe o **CNPJ**, **UF** e se começamos em **homologação** ou **produção**.

Observação: em homologação a SEFAZ normalmente não devolve notas reais, então
o teste completo com XMLs de verdade será em produção. Homologação já valida o
caminho mTLS e a comunicação.
