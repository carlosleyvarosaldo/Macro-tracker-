/**
 * SHA-256 hash with per-user salt. Not bank-grade security — local-only PWA
 * acceptable trade-off — but prevents trivial password reading from IndexedDB.
 */

const SALT_BYTES = 16;

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function generateSalt(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return bytesToHex(salt.buffer);
}

export async function hashPassword(
  password: string,
  saltHex: string
): Promise<string> {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const passwordBytes = enc.encode(password);

  const combined = new Uint8Array(salt.length + passwordBytes.length);
  combined.set(salt, 0);
  combined.set(passwordBytes, salt.length);

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return bytesToHex(digest);
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  return actual === expectedHashHex;
}