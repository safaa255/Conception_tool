'use strict';
// Extracts claude.ai session cookies from Brave/Chrome using the decrypted AES key
// Usage: node extract_cookie.js <hex-aes-key> <cookies-db-path>

const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const [,, hexKey, dbPath] = process.argv;
if (!hexKey || !dbPath) {
  console.error('Usage: node extract_cookie.js <hex-aes-key> <db-path>');
  process.exit(1);
}

const aesKey = Buffer.from(hexKey, 'hex');

function decryptCookie(encryptedValue) {
  try {
    const buf = Buffer.from(encryptedValue);
    if (buf.length < 16) return null;
    const prefix = buf.slice(0, 3).toString();
    if (prefix !== 'v10' && prefix !== 'v11') return buf.toString('utf8') || null;
    const nonce = buf.slice(3, 15);        // 12 bytes
    const tag   = buf.slice(buf.length - 16);
    const data  = buf.slice(15, buf.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce);
    decipher.setAuthTag(tag);
    return decipher.update(data, null, 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

const db = new DatabaseSync(dbPath, { open: true });
const rows = db.prepare(
  "SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%claude.ai%' ORDER BY name"
).all();
db.close();

if (!rows.length) {
  console.log('No claude.ai cookies found in this profile.');
  process.exit(0);
}

const parts = [];
for (const row of rows) {
  const val = decryptCookie(row.encrypted_value);
  if (val) parts.push(`${row.name}=${val}`);
}

console.log('\n--- claude.ai cookies ---');
console.log(parts.join('; '));
console.log('\n--- cookie count:', parts.length);
