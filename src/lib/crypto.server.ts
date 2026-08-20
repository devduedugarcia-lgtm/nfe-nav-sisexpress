// Cifra/decifra dados sensíveis (certificado A1 e sua senha) com AES-256-GCM.
// Server-only: a chave vem de CERT_ENCRYPTION_KEY e nunca entra no bundle do cliente.

async function cryptoKey(): Promise<CryptoKey> {
  const raw = process.env["CERT_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Cofre de certificados não configurado (CERT_ENCRYPTION_KEY).");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw) as unknown as BufferSource,
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Devolve `iv.ciphertext` em base64, pronto para gravar em uma coluna de texto. */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await cryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as unknown as BufferSource,
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  const [ivPart, dataPart] = stored.split(".");
  if (!ivPart || !dataPart) throw new Error("Dado cifrado inválido.");
  const key = await cryptoKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) as unknown as BufferSource },
    key,
    fromBase64(dataPart) as unknown as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export function sha256Base64(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === "string" ? fromBase64(input) : input;
  return crypto.subtle
    .digest("SHA-256", bytes as unknown as BufferSource)
    .then((digest) =>
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
}