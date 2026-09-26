import { gcm } from "@noble/ciphers/aes.js";

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

/**
 * The per-user AES-256-GCM key. Web Crypto keeps it non-extractable; on an insecure
 * origin (http://LAN-IP) `crypto.subtle` does not exist, so the same cipher runs in
 * audited JS (@noble/ciphers) with the raw key kept in IndexedDB. Either way nothing
 * is ever stored in plaintext — encryption is mandatory for offline data.
 */
export type OfflineKey =
  | { kind: "webcrypto"; key: CryptoKey }
  | { kind: "software"; raw: Uint8Array };

/** What the `keys` store holds for a user — exactly one of the two. */
export type StoredOfflineKey = { key?: CryptoKey; raw?: ArrayBuffer };

function randomBytes(length: number): Uint8Array {
  // getRandomValues is available on insecure origins too (only `subtle` is not).
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export async function createUserOfflineKey(): Promise<OfflineKey> {
  if (isWebCryptoAvailable()) {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    return { kind: "webcrypto", key };
  }
  return { kind: "software", raw: randomBytes(32) };
}

export function toStoredKey(key: OfflineKey): StoredOfflineKey {
  return key.kind === "webcrypto"
    ? { key: key.key }
    : { raw: toArrayBuffer(key.raw) };
}

export function fromStoredKey(stored: StoredOfflineKey): OfflineKey | null {
  if (stored.key && isWebCryptoAvailable()) {
    return { kind: "webcrypto", key: stored.key };
  }
  if (stored.raw && stored.raw.byteLength === 32) {
    return { kind: "software", raw: new Uint8Array(stored.raw) };
  }
  return null;
}

export type EncryptedPayload = {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

export async function encryptBytes(
  key: OfflineKey,
  bytes: ArrayBuffer,
): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  if (key.kind === "webcrypto") {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer> },
      key.key,
      bytes,
    );
    return { iv: toArrayBuffer(iv), ciphertext };
  }
  const ciphertext = gcm(key.raw, iv).encrypt(new Uint8Array(bytes));
  return { iv: toArrayBuffer(iv), ciphertext: toArrayBuffer(ciphertext) };
}

export async function decryptBytes(
  key: OfflineKey,
  payload: EncryptedPayload,
): Promise<ArrayBuffer> {
  if (key.kind === "webcrypto") {
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
      key.key,
      payload.ciphertext,
    );
  }
  const plain = gcm(key.raw, new Uint8Array(payload.iv)).decrypt(
    new Uint8Array(payload.ciphertext),
  );
  return toArrayBuffer(plain);
}

export async function encryptJson(
  key: OfflineKey,
  value: unknown,
): Promise<EncryptedPayload> {
  const plaintext = te.encode(JSON.stringify(value));
  return encryptBytes(key, toArrayBuffer(plaintext));
}

export async function decryptJson<T>(
  key: OfflineKey,
  payload: EncryptedPayload,
): Promise<T> {
  const plain = await decryptBytes(key, payload);
  return JSON.parse(td.decode(plain)) as T;
}
