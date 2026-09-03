const te = new TextEncoder();
const td = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/** Web Crypto AES-GCM requires a secure context (HTTPS or localhost). */
export function isWebCryptoAvailable(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  );
}

class OfflineCryptoUnavailableError extends Error {
  constructor(
    message = "التشفير غير متاح في هذا السياق — استخدم localhost أو HTTPS للعمل دون اتصال.",
  ) {
    super(message);
    this.name = "OfflineCryptoUnavailableError";
  }
}

export async function createUserCryptoKey(): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export type EncryptedPayload = {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedPayload> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = te.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return { iv: toArrayBuffer(iv), ciphertext };
}

export async function decryptJson<T>(
  key: CryptoKey,
  payload: EncryptedPayload,
): Promise<T> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    payload.ciphertext,
  );
  return JSON.parse(td.decode(plain)) as T;
}

export async function encryptBytes(
  key: CryptoKey,
  bytes: ArrayBuffer,
): Promise<EncryptedPayload> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes,
  );
  return { iv: toArrayBuffer(iv), ciphertext };
}

export async function decryptBytes(
  key: CryptoKey,
  payload: EncryptedPayload,
): Promise<ArrayBuffer> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    payload.ciphertext,
  );
}
