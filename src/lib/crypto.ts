import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";

export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** scrypt$<salt hex>$<hash hex> */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(secret, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomId(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return out;
}

export const newUid = () => randomId(12);
export const newLoginId = () => randomId(6);
export const newJoinCode = () => randomId(6).toUpperCase();
export const newPin = () => String(randomInt(10000)).padStart(4, "0");
