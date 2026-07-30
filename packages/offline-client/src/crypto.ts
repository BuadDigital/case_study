const te = new TextEncoder();
const td = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function createUserCryptoKey(): Promise<CryptoKey> {
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
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    payload.ciphertext,
  );
}
