/* eslint-disable no-console */
const crypto = require("crypto");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-admin-password.js <password>");
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const N = 1 << 14;
const r = 8;
const p = 1;
const keylen = 32;

crypto.scrypt(password, salt, keylen, { N, r, p }, (err, derivedKey) => {
  if (err) throw err;
  const out = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
  console.log(out);
});

