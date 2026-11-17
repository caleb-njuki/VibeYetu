// Finds your running ngrok address and writes it into backend/.env (DARAJA_CALLBACK_BASE_URL).
// 1. Start ngrok in its own window:  ngrok http 5000
// 2. In the backend folder run:      node scripts/set-ngrok.js
// 3. Restart the server (Ctrl+C, then npm run dev). Do this every time you restart ngrok: its address changes.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const KEY = 'DARAJA_CALLBACK_BASE_URL';

if (!existsSync(envFile)) {
  console.log('There is no .env file in the backend folder.');
  process.exit(1);
}

let tunnels;
try {
  const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: AbortSignal.timeout(4000) });
  tunnels = (await res.json()).tunnels ?? [];
} catch {
  console.log('Could not find ngrok. Start it first in another terminal window:');
  console.log('    ngrok http 5000');
  console.log('Wait until it shows a "Forwarding" line, then run this again.');
  process.exit(1);
}

const https = tunnels.map((t) => t.public_url).find((u) => /^https:\/\//.test(u));
if (!https) {
  console.log('ngrok is running but has no https address yet. Wait a few seconds and run this again.');
  process.exit(1);
}
const address = https.replace(/\/+$/, '');

const text = readFileSync(envFile, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/);
const at = lines.findIndex((l) => l.trim().startsWith(`${KEY}=`));
if (at >= 0) lines[at] = `${KEY}=${address}`;
else {
  if (lines.at(-1) === '') lines.pop();
  lines.push(`${KEY}=${address}`, '');
}
writeFileSync(envFile, lines.join(eol));
console.log(`Saved to .env:  ${KEY}=${address}`);
console.log('Now restart the server (Ctrl+C, then npm run dev) so it uses the new address.');
