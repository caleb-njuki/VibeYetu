// Checks backend/.env and the database, and tells you in plain words what to fix.
// It never prints your secrets. Run it from the backend folder:  node scripts/check-env.js
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let problems = 0;
let warnings = 0;
const ok = (m) => console.log(`  OK   ${m}`);
const bad = (m) => { problems++; console.log(`  FIX  ${m}`); };
const warn = (m) => { warnings++; console.log(`  NOTE ${m}`); };
const head = (t) => console.log(`\n${t}`);

// Reads a .env file the same way the server does (KEY=value per line).
function parse(file) {
  const values = new Map();
  const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq < 1) return bad(`Line ${i + 1} of .env is not KEY=value.`);
    const key = line.slice(0, eq);
    if (key !== key.trim() || /\s/.test(key)) bad(`Line ${i + 1}: there must be no spaces before the "=" (${key.trim()}).`);
    let v = line.slice(eq + 1);
    if (/^["'].*["']$/.test(v)) { warn(`${key.trim()}: remove the quote marks around the value.`); v = v.slice(1, -1); }
    values.set(key.trim(), v);
  });
  return values;
}

console.log('VibeYetu .env check (your secrets are never printed)');

const envFile = path.join(root, '.env');
const exampleFile = path.join(root, '.env.example');
head('1. The file');
if (!existsSync(envFile)) {
  bad('There is no file named .env in the backend folder. Copy .env.example, rename the copy to .env, then fill it in.');
  console.log('\nStopped: fix the line above and run this again.');
  process.exit(1);
}
ok('.env exists in the backend folder');
const env = parse(envFile);
const example = existsSync(exampleFile) ? parse(exampleFile) : new Map();

const get = (k) => (env.get(k) ?? '').trim();
const template = (v) => /^(your_|put_|change_me|paste)/i.test(v) || /your-tunnel|your_tunnel/i.test(v);
const filled = (k) => get(k) !== '' && !template(get(k));
const secret = (k, rule, ruleText) => {
  const v = get(k);
  if (v === '') return bad(`${k} is empty.`);
  if (template(v)) return bad(`${k} is still the example text. Put your real value.`);
  if (rule && !rule(v)) return bad(`${k}: ${ruleText}`);
  ok(`${k} is set (${v.length} characters)`);
};

head('2. Always needed');
const port = get('PORT');
/^\d+$/.test(port) ? ok(`PORT=${port}`) : bad('PORT must be a number, for example 5000.');
get('CORS_ORIGIN') === 'http://localhost:5173' ? ok('CORS_ORIGIN=http://localhost:5173 (your frontend address)') : (get('CORS_ORIGIN') ? warn(`CORS_ORIGIN is ${get('CORS_ORIGIN')}. For testing on your computer it should be http://localhost:5173`) : bad('CORS_ORIGIN is empty.'));
for (const k of ['DB_HOST', 'DB_NAME', 'DB_USER']) get(k) ? ok(`${k}=${get(k)}`) : bad(`${k} is empty.`);
/^\d+$/.test(get('DB_PORT')) ? ok(`DB_PORT=${get('DB_PORT')}`) : bad('DB_PORT must be a number (PostgreSQL normally uses 5432).');
secret('DB_PASSWORD');
secret('JWT_SECRET', (v) => v.length >= 32, 'must be at least 32 characters. Make one with: node -e "console.log(require(\'node:crypto\').randomBytes(48).toString(\'hex\'))"');
secret('DATA_ENCRYPTION_KEY', (v) => /^[0-9a-fA-F]{64}$/.test(v), 'must be exactly 64 letters/numbers (0-9, a-f). Make one with: node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"');
get('JWT_SECRET') && get('JWT_SECRET') === get('DATA_ENCRYPTION_KEY') && bad('JWT_SECRET and DATA_ENCRYPTION_KEY must be two different values.');

head('3. Payments');
const mode = get('PAYMENTS_MODE') || 'simulated';
if (!['simulated', 'daraja'].includes(mode)) bad(`PAYMENTS_MODE is "${mode}". It must be simulated or daraja.`);
else if (mode === 'simulated') ok('PAYMENTS_MODE=simulated (no real money; good for the first test). The Daraja lines below are not needed yet.');
else {
  ok('PAYMENTS_MODE=daraja (real M-Pesa sandbox)');
  secret('DARAJA_CONSUMER_KEY');
  secret('DARAJA_CONSUMER_SECRET');
  secret('DARAJA_PASSKEY');
  /^\d{5,7}$/.test(get('DARAJA_SHORTCODE')) ? ok(`DARAJA_SHORTCODE=${get('DARAJA_SHORTCODE')}`) : bad('DARAJA_SHORTCODE must be 5 to 7 digits. In the sandbox it is 174379.');
  const base = get('DARAJA_CALLBACK_BASE_URL');
  if (!/^https:\/\/[^\s/]+/.test(base) || template(base)) bad('DARAJA_CALLBACK_BASE_URL must be your ngrok address starting with https:// (copy the "Forwarding" address ngrok shows).');
  else if (/https:\/\/[^/]+\/.+/.test(base.replace(/\/+$/, ''))) bad('DARAJA_CALLBACK_BASE_URL must be only the address, with nothing after .app or .dev (no /api, no /hooks).');
  else ok('DARAJA_CALLBACK_BASE_URL looks right (it changes every time you restart ngrok on the free plan)');
  secret('DARAJA_CALLBACK_SECRET', (v) => /^[A-Za-z0-9_-]{24,}$/.test(v), 'must be 24 or more letters/numbers only.');
}
const pmode = get('PAYOUTS_MODE') || 'off';
if (pmode === 'off') ok('PAYOUTS_MODE=off (payouts and refunds wait in the queue; nothing is sent)');
else if (pmode !== 'daraja') bad(`PAYOUTS_MODE is "${pmode}". It must be off or daraja.`);
else {
  mode !== 'daraja' && bad('PAYOUTS_MODE=daraja needs PAYMENTS_MODE=daraja.');
  filled('DARAJA_INITIATOR_NAME') ? ok('DARAJA_INITIATOR_NAME is set') : bad('DARAJA_INITIATOR_NAME is empty.');
  const viaCert = filled('DARAJA_INITIATOR_PASSWORD') && get('DARAJA_CERT_PATH') && existsSync(path.resolve(root, get('DARAJA_CERT_PATH')));
  filled('DARAJA_SECURITY_CREDENTIAL') || viaCert ? ok('The initiator security credential is set') : bad('Set DARAJA_SECURITY_CREDENTIAL (generated on the Daraja portal) or both DARAJA_INITIATOR_PASSWORD and DARAJA_CERT_PATH.');
  filled('DARAJA_PAYOUT_SHORTCODE') ? ok('DARAJA_PAYOUT_SHORTCODE is set') : warn('DARAJA_PAYOUT_SHORTCODE is empty. In the sandbox, payouts normally need the test shortcode shown on the Daraja portal.');
}

head('4. Other services (the server runs without them)');
const cl = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map(filled);
cl.every(Boolean) ? ok('Cloudinary photos: all 3 values set') : cl.some(Boolean) ? bad('Cloudinary: only some of the 3 values are set. Set all three or leave all three empty.') : warn('Cloudinary is not set, so photo uploads will say "not set up".');
filled('AI_API_KEY') ? (/^AIza/.test(get('AI_API_KEY')) ? ok('AI_API_KEY is set (looks like a Google key)') : warn('AI_API_KEY does not start with AIza. Check you copied the Google AI Studio key.')) : warn('AI_API_KEY is empty. The help assistant will use its built-in answers.');
get('AT_USERNAME') ? ok(`AT_USERNAME=${get('AT_USERNAME')}`) : bad('AT_USERNAME is empty. In the sandbox it is sandbox.');
filled('AT_API_KEY') ? ok('AT_API_KEY is set (SMS codes still print in this terminal while NODE_ENV=development)') : warn('AT_API_KEY is empty. Fine for now: in development the SMS codes are printed in the server terminal.');
get('NODE_ENV') === 'development' || get('NODE_ENV') === '' ? ok('NODE_ENV=development') : warn(`NODE_ENV=${get('NODE_ENV')}. For testing it should be development.`);

head('5. Mistakes');
const known = new Set(example.keys());
const unknown = [...env.keys()].filter((k) => known.size && !known.has(k));
unknown.length ? warn(`These names in .env are not in .env.example (typo?): ${unknown.join(', ')}`) : ok('Every name in .env is a known setting');
const missing = [...known].filter((k) => !env.has(k));
missing.length ? warn(`These settings from .env.example are missing in .env: ${missing.join(', ')}`) : ok('Nothing from .env.example is missing in .env');
const ignoreText = ['../.gitignore', '.gitignore'].map((f) => path.join(root, f)).filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
/^\.env$/m.test(ignoreText) ? ok('.env is ignored by git (it will not be uploaded to GitHub)') : bad('.env is NOT in .gitignore. Add a line with .env to the .gitignore file so your keys never reach GitHub.');
if (existsSync(exampleFile)) {
  const leaked = [...example].filter(([k, v]) => /KEY|SECRET|PASSWORD|PASSKEY/.test(k) && v && !template(v) && env.get(k) === v);
  leaked.length ? bad(`.env.example holds your real value for: ${leaked.map(([k]) => k).join(', ')}. .env.example goes to GitHub: put placeholders there and keep the real values only in .env.`) : ok('.env.example has no real secrets');
}

head('6. The database');
let pg;
try { pg = (await import('pg')).default; } catch { warn('Could not load the pg package. Run: npm install'); }
if (pg && get('DB_HOST') && /^\d+$/.test(get('DB_PORT'))) {
  const connect = async (portNumber) => {
    const client = new pg.Client({ host: get('DB_HOST'), port: Number(portNumber), database: get('DB_NAME'), user: get('DB_USER'), password: get('DB_PASSWORD'), connectionTimeoutMillis: 4000 });
    await client.connect();
    return client;
  };
  let client = null;
  try {
    client = await connect(get('DB_PORT'));
    ok(`Connected to PostgreSQL database "${get('DB_NAME')}" on port ${get('DB_PORT')}`);
  } catch (err) {
    const code = err.code || '';
    if (code === '28P01' || code === '28000') bad('PostgreSQL refused the login: DB_USER or DB_PASSWORD is wrong.');
    else if (code === '3D000') bad(`The database "${get('DB_NAME')}" does not exist. Create it in pgAdmin (right-click Databases, Create), name it ${get('DB_NAME')}.`);
    else {
      bad(`Could not reach PostgreSQL on port ${get('DB_PORT')} (${err.code || err.message}). Is PostgreSQL running?`);
      const other = get('DB_PORT') === '5432' ? '5433' : '5432';
      try { (await connect(other)).end(); warn(`But it answers on port ${other}. Change DB_PORT to ${other} in .env.`); } catch { /* not there either */ }
    }
  }
  if (client) {
    try {
      const dir = path.join(root, 'migrations');
      const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
      const hasTable = (await client.query(`SELECT to_regclass('public.schema_migrations') AS t`)).rows[0].t;
      const applied = new Map(hasTable ? (await client.query('SELECT filename, checksum FROM schema_migrations')).rows.map((r) => [r.filename, r.checksum]) : []);
      const pending = [];
      const changed = [];
      for (const f of files) {
        const sum = createHash('sha256').update(readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
        if (!applied.has(f)) pending.push(f);
        else if (applied.get(f) !== sum) changed.push(f);
      }
      const gone = [...applied.keys()].filter((f) => !files.includes(f));
      ok(`${files.length} migration files in backend/migrations (latest: ${files.at(-1)})`);
      pending.length ? bad(`Not applied yet: ${pending.join(', ')}. Run: node src/migrate.js`) : ok('Every migration is applied');
      changed.length && bad(`Changed after being applied: ${changed.join(', ')}. Put the original file back.`);
      gone.length && warn(`Applied in the database but no file in the folder: ${gone.join(', ')} (renamed or deleted?). Tell me before running migrate.`);
    } catch (err) {
      bad(`Could not read the migrations: ${err.message}`);
    } finally {
      await client.end();
    }
  }
}

console.log(`\n${problems === 0 ? 'RESULT: no problems found.' : `RESULT: ${problems} thing(s) to fix (lines marked FIX).`}${warnings ? ` ${warnings} note(s) for your information.` : ''}`);
process.exit(problems === 0 ? 0 : 1);
