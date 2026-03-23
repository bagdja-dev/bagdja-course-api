import crypto from "crypto";

const SCRYPT_KEYLEN = 32;

function b64(buf: Buffer) {
  return buf.toString("base64");
}

function fromB64(s: string) {
  return Buffer.from(s, "base64");
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const N = 1 << 14; // cost (kept moderate to avoid memory limit issues)
  const r = 8;
  const p = 1;

  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt$${N}$${r}$${p}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 7) return false;
  const [, algo, nStr, rStr, pStr, saltB64, hashB64] = parts;
  if (algo !== "scrypt") return false;

  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = fromB64(saltB64);
  const expected = fromB64(hashB64);

  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return crypto.timingSafeEqual(actual, expected);
}
