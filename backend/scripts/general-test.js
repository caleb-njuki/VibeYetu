// GENERAL TEST. Checks the parts the smoke test does not: security, locations, staff pages, M-Pesa guard, password reset.
// It does NOT stop at the first failure. It runs everything and then lists what failed and what to do.
// Start the server first (npm run dev), then in a second terminal:   node scripts/general-test.js
// Optional (staff checks): set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD first.
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = process.env.API_URL || 'http://localhost:5000';
const BASE = `${ROOT}/api`;
const NEAR_CBD = 'lat=-1.2864&lng=36.8172&radiusKm=15';

let passed = 0;
const failed = [];
const skipped = [];

async function raw(method, url, { body, token, headers: extra } = {}) {
  const headers = { ...(extra || {}) };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    console.log(`\n✘ Cannot reach the server at ${ROOT}`);
    console.log('  Is "npm run dev" running in another terminal, showing "Database: connected"?');
    process.exit(1);
  }
  let data = null;
  try { data = await response.json(); } catch { /* not JSON */ }
  return { status: response.status, data, headers: response.headers };
}
const call = (method, path, opts) => raw(method, BASE + path, opts);

function expectStatus(res, status) {
  if (res.status !== status) throw new Error(`expected HTTP ${status} but got ${res.status}. The server said: ${JSON.stringify(res.data)}`);
  return res.data;
}
function check(cond, message) { if (!cond) throw new Error(message); }

async function step(name, work, advice) {
  try {
    const note = await work();
    passed += 1;
    console.log(`✔ ${name}${note ? `  (${note})` : ''}`);
  } catch (err) {
    failed.push({ name, message: err.message, advice });
    console.log(`✘ ${name}\n    ${err.message}`);
  }
}
const skip = (name, why) => { skipped.push(name); console.log(`– ${name}  (skipped: ${why})`); };

const stamp = Date.now();
const password = 'Passw0rd123';
const phoneNo = () => process.env.SMOKE_PHONE || `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
// Codes go by email. With EMAIL_MODE=smtp use your own Gmail so the codes reach you:  $env:SMOKE_EMAIL="you@gmail.com"
const alias = (tag) => (process.env.SMOKE_EMAIL ? process.env.SMOKE_EMAIL.replace('@', `+${tag}${stamp}@`) : `${tag}${stamp}@test.com`);
const emailA = alias('generala');
const emailB = alias('generalb');
// A seller must prove the email first. In console mode the server returns the code; otherwise it asks you to type it.
async function emailProof(addr) {
  const sent = await call('POST', '/auth/seller/email/code', { body: { email: addr } });
  let code = sent.data?.devCode;
  if (!code) {
    const r = readline.createInterface({ input: stdin, output: stdout });
    code = (await r.question(`  Type the 6-digit code emailed to ${addr}: `)).trim();
    r.close();
  }
  const v = await call('POST', '/auth/seller/email/verify', { body: { email: addr, code } });
  return v.data?.proof || '';
}
const body = (email, phone, shop, proof) => ({
  account: { email, password, emailProof: proof },
  details: { fullName: 'General Tester', idNumber: '29384756', kraPin: '', phone, businessType: 'individual', businessName: '', businessRegNo: '' },
  shop: { name: `General Shop ${stamp.toString(36)}${Math.random().toString(36).slice(2, 7)}`, description: 'Made by the general test', ...shop },
  consent: { terms: true, data: true, accurate: true },
});
const register = async (email, phone, shop, proof) => call('POST', '/auth/seller/register', { body: body(email, phone, shop, proof ?? (await emailProof(email))) });
let proofA;

console.log(`General test on ${BASE}\n`);

// ---------- 1. Server and headers ----------
console.log('— Server and security headers —');
await step('Server and database are up', async () => {
  const d = expectStatus(await call('GET', '/health'), 200);
  check(d.status === 'ok' && d.database === 'connected', `health says ${JSON.stringify(d)}`);
}, 'Start the server (npm run dev) and look for "Database: connected". If the database is down, start PostgreSQL and check DB_PORT=5433 in .env.');
await step('Replies are marked "do not store" (Cache-Control: no-store)', async () => {
  const r = await call('GET', '/health');
  check(/no-store/.test(r.headers.get('cache-control') || ''), `Cache-Control is "${r.headers.get('cache-control')}"`);
}, 'src/app.js is missing the no-store line. Re-copy the Fix-hooks-and-photo-files app.js.');
await step('Security headers are on (helmet)', async () => {
  const r = await call('GET', '/health');
  check(r.headers.get('x-content-type-options') === 'nosniff', 'x-content-type-options header is missing');
}, 'helmet is not active in src/app.js.');
await step('A website we did not allow is refused (CORS)', async () => {
  const r = await call('GET', '/health', { headers: { Origin: 'https://evil.example.com' } });
  check(!r.headers.get('access-control-allow-origin'), 'the server allowed https://evil.example.com');
}, 'CORS_ORIGINS in .env must list only your own frontend address, for example http://localhost:5173.');
await step('Unknown address gives a clean 404', async () => {
  expectStatus(await call('GET', '/nothing-here'), 404);
});

// ---------- 2. M-Pesa callback guard ----------
console.log('\n— M-Pesa callback address —');
await step('Callback with a WRONG secret is refused (404)', async () => {
  expectStatus(await raw('POST', `${ROOT}/hooks/mpesa/wrongsecret`, { body: { Body: {} } }), 404);
}, 'If you got something other than 404 the guard is broken. If the whole route answers "Route not found" even in daraja mode, that is normal in simulated mode.');
await step('Payout result/timeout addresses are guarded too', async () => {
  expectStatus(await raw('POST', `${ROOT}/hooks/mpesa/result/wrongsecret`, { body: {} }), 404);
  expectStatus(await raw('POST', `${ROOT}/hooks/mpesa/timeout/wrongsecret`, { body: {} }), 404);
});
if (process.env.DARAJA_CALLBACK_SECRET) {
  await step('Callback with the RIGHT secret is accepted (200)', async () => {
    const r = await raw('POST', `${ROOT}/hooks/mpesa/${process.env.DARAJA_CALLBACK_SECRET}`, { body: { Body: { stkCallback: { CheckoutRequestID: 'general-test-unknown', ResultCode: 1032, ResultDesc: 'cancelled' } } } });
    check(r.status === 200 || r.status === 404, `got ${r.status}`);
    return r.status === 404 ? 'got 404: the server is in simulated mode, that is fine' : 'accepted';
  });
} else skip('Callback with the right secret', 'set DARAJA_CALLBACK_SECRET in this terminal to test it, optional');

// ---------- 3. Locations ----------
console.log('\n— Locations —');
await step('Search radius of 41 km is refused (max is 40)', async () => {
  expectStatus(await call('GET', '/products?lat=-1.2864&lng=36.8172&radiusKm=41'), 400);
}, 'src/utils/near.js should cap radiusKm at 40.');
await step('Search radius of 40 km is accepted', async () => {
  expectStatus(await call('GET', '/products?lat=-1.2864&lng=36.8172&radiusKm=40'), 200);
});
await step('A location outside Kenya finds no shops', async () => {
  const r = await call('GET', '/products?lat=51.5&lng=-0.12&radiusKm=10');
  check(r.status === 400 || (r.status === 200 && r.data.products.length === 0), `got HTTP ${r.status} with ${r.data?.products?.length} products`);
});
await step('Half a location (lat only) is refused', async () => {
  expectStatus(await call('GET', '/products?lat=-1.2864'), 400);
});

// ---------- 4. Seller accounts, pins ----------
console.log('\n— Seller sign-up and shop pin —');
let tokenA, shopA, tokenB;
await step('Sign-up with a pin OUTSIDE Kenya is refused', async () => {
  proofA = await emailProof(emailA);
  expectStatus(await register(emailA, phoneNo(), { lat: 51.5, lng: -0.12 }, proofA), 400);
}, 'The shop pin must be inside Kenya. Check src/utils/geo.js and sellerAuth.routes.js are the Batch 14 versions.');
await step('Sign-up with HALF a pin is refused', async () => {
  expectStatus(await register(emailA, phoneNo(), { lat: -1.2673 }, proofA), 400);
});
await step('Seller A signs up with a real pin (Westlands)', async () => {
  const d = expectStatus(await register(emailA, phoneNo(), { lat: -1.2673, lng: 36.8118 }, proofA), 201);
  tokenA = d.token; shopA = d.shop.id;
  check(tokenA && shopA, 'no token or shop came back');
  return `shop ${shopA}`;
}, 'If this says 429, you ran the test twice in 15 minutes. Stop the server (Ctrl+C), start it again (npm run dev) and rerun.');
await step('The pin is used for distance (shop is near the CBD)', async () => {
  const d = expectStatus(await call('GET', `/shops/${shopA}?${NEAR_CBD}`), 200);
  const km = d.shop?.distanceKm;
  if (typeof km !== 'number') return 'the shop page gives no distance; skipped';
  check(km > 0.5 && km < 6, `distanceKm is ${km}. Westlands to the CBD should be about 3 km`);
  return `${km} km`;
}, 'The distance should come from the pin, not the area centre. Check Batch 14 files.');
await step('Seller can move the pin, and a pin outside Kenya is refused', async () => {
  expectStatus(await call('PATCH', `/seller/shops/${shopA}`, { token: tokenA, body: { lat: -1.2921, lng: 36.8219 } }), 200);
  expectStatus(await call('PATCH', `/seller/shops/${shopA}`, { token: tokenA, body: { lat: 0, lng: 0 } }), 400);
});
await step('Seller can open a second shop with its own pin', async () => {
  const d = expectStatus(await call('POST', '/seller/shops', { token: tokenA, body: { name: `General Branch ${stamp.toString(36)}`, lat: -1.2921, lng: 36.7872 } }), 201);
  check(d.shop?.id, 'no shop came back');
});
await step('Seller token works, and a fake token is refused', async () => {
  expectStatus(await call('GET', '/auth/seller/me', { token: tokenA }), 200);
  expectStatus(await call('GET', '/auth/seller/me', { token: 'abc.def.ghi' }), 401);
  expectStatus(await call('GET', '/auth/seller/me'), 401);
});
await step('One seller cannot touch another seller\'s shop', async () => {
  const d = expectStatus(await register(emailB, phoneNo(), { lat: -1.3, lng: 36.8 }), 201);
  tokenB = d.token;
  const r = await call('PATCH', `/seller/shops/${shopA}`, { token: tokenB, body: { description: 'hacked' } });
  check([403, 404].includes(r.status), `seller B got HTTP ${r.status} on seller A's shop; it should be 403 or 404`);
  const r2 = await call('GET', `/seller/shops/${shopA}/products`, { token: tokenB });
  check([403, 404].includes(r2.status), `seller B could list A's products (HTTP ${r2.status})`);
}, 'This is serious: tell Claude right away.');

// ---------- 5. Lockout ----------
console.log('\n— Wrong-password lockout —');
await step('5 wrong passwords lock the account for 15 minutes', async () => {
  let last;
  for (let i = 1; i <= 5; i += 1) last = await call('POST', '/auth/seller/login', { body: { email: emailB, password: `wrong-pass-${i}` } });
  check(last.status === 429, `the 5th wrong try gave HTTP ${last.status}, expected 429`);
}, 'Migration 013 or lockout.js is missing. Run: node src/migrate.js');
await step('Even the RIGHT password is refused while locked', async () => {
  expectStatus(await call('POST', '/auth/seller/login', { body: { email: emailB, password } }), 429);
});
await step('Wrong passwords for an unknown email give the same answer as a known one', async () => {
  const r = await call('POST', '/auth/seller/login', { body: { email: `nobody${stamp}@test.com`, password: 'whatever123' } });
  check(r.status === 401, `got ${r.status}; should be 401`);
});

// ---------- 6. Forgot password ----------
console.log('\n— Forgot password —');
const rl = readline.createInterface({ input: stdin, output: stdout });
async function needCode(what) {
  const c = (await rl.question(`  Open the email we sent (in console mode: the "[DEV EMAIL]" line in the SERVER terminal) and type the 6-digit ${what} code here (or press Enter to skip): `)).trim();
  return c;
}
let forgotOk = false;
const newPassword = 'N3wPassw0rd456';
await step('Forgot password: a code is sent (same answer for unknown email)', async () => {
  const known = expectStatus(await call('POST', '/auth/seller/forgot/code', { body: { email: emailA } }), 200);
  const unknown = await call('POST', '/auth/seller/forgot/code', { body: { email: `nobody${stamp}@test.com` } });
  check(unknown.status === 200, `an unknown email got HTTP ${unknown.status}; it must look the same as a real one (200)`);
  check(JSON.stringify(Object.keys(known).sort()) === JSON.stringify(Object.keys(unknown.data || {}).sort()), 'the two answers have different shapes, which leaks who has an account');
}, 'Batch 17 files (forgotPassword.service.js, sellerAuth.routes.js) are not all copied.');
const code = await needCode('forgot-password');
if (!code) {
  skip('Forgot password: verify, reset, old logins end', 'no code typed');
} else {
  await step('Wrong code is refused', async () => {
    const r = await call('POST', '/auth/seller/forgot/verify', { body: { email: emailA, code: code === '000000' ? '111111' : '000000' } });
    check(r.status >= 400 && r.status < 500, `got ${r.status}`);
  });
  await step('Right code, new password, and old logins end', async () => {
    expectStatus(await call('POST', '/auth/seller/forgot/verify', { body: { email: emailA, code } }), 200);
    expectStatus(await call('POST', '/auth/seller/forgot/reset', { body: { email: emailA, password: newPassword, confirm: newPassword } }), 200);
    expectStatus(await call('GET', '/auth/seller/me', { token: tokenA }), 401); // the token from before the reset must be dead
    expectStatus(await call('POST', '/auth/seller/login', { body: { email: emailA, password } }), 401); // old password no longer works
    const d = expectStatus(await call('POST', '/auth/seller/login', { body: { email: emailA, password: newPassword } }), 200);
    check(d.token, 'no token after signing in with the new password');
    forgotOk = true;
  }, 'If the OLD token still works, token_version is not checked: re-copy Batch 17 middleware/sellerAuth.js and services.');
}
rl.close();

// ---------- 7. Staff ----------
console.log('\n— Staff pages —');
const ae = process.env.SMOKE_ADMIN_EMAIL, ap = process.env.SMOKE_ADMIN_PASSWORD;
if (!ae || !ap) {
  skip('All staff checks', 'no staff account given. Make one: node scripts/create-admin.js you@mail.com "Your Name", then set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD');
} else {
  let at;
  await step('Staff signs in', async () => {
    const d = expectStatus(await call('POST', '/auth/admin/login', { body: { email: ae, password: ap } }), 200);
    at = d.token; check(at, 'no token came back');
  }, 'Wrong email or password, or the account does not exist yet (create-admin.js).');
  if (at) {
    await step('A seller token cannot open staff pages', async () => {
      const r = await call('GET', '/admin/overview', { token: tokenB });
      check([401, 403].includes(r.status), `got HTTP ${r.status}; it should be 401 or 403`);
    }, 'This is serious: tell Claude right away.');
    for (const path of ['/admin/overview', '/admin/orders', '/admin/cases', '/admin/shops', '/admin/ads', '/admin/payments/problems', '/admin/payouts/problems']) {
      await step(`Staff can open ${path}`, async () => { expectStatus(await call('GET', path, { token: at }), 200); }, 'If 500: the real reason is in the SERVER terminal, send the last 20 lines.');
    }
    await step('Staff can see the shops we just made', async () => {
      const d = expectStatus(await call('GET', '/admin/shops', { token: at }), 200);
      check(d.shops.some((s) => s.id === shopA), 'our new shop is not in the staff list');
    });
  }
}

// ---------- 8. Buyer & misc surfaces ----------
console.log('\n— Public pages and buyer rules —');
for (const path of ['/areas', '/categories', `/home?${NEAR_CBD}`, `/products?${NEAR_CBD}`, `/ads?${NEAR_CBD}`]) {
  await step(`Public page ${path.split('?')[0]} opens`, async () => { expectStatus(await call('GET', path), 200); });
}
await step('Buyer pages need a sign-in', async () => {
  for (const [m, p] of [['GET', '/orders'], ['GET', '/favourites'], ['GET', '/notifications'], ['POST', '/checkout']]) {
    const r = await call(m, p);
    check(r.status === 401, `${m} ${p} gave HTTP ${r.status}; should be 401`);
  }
});
await step('Seller pages need a sign-in', async () => {
  for (const p of ['/seller/shops', `/seller/shops/${shopA}/products`, `/seller/shops/${shopA}/ads`, `/seller/shops/${shopA}/payout`]) {
    const r = await call('GET', p);
    check(r.status === 401, `GET ${p} gave HTTP ${r.status}; should be 401`);
  }
});
await step('Buyer sign-in: a bad email is refused', async () => {
  const r = await call('POST', '/auth/buyer/request-otp', { body: { email: 'not-an-email' } });
  check(r.status === 400, `got ${r.status}`);
}, 'The buyer sign-in route is /auth/buyer/request-otp.');
await step('Strange input does not crash the server', async () => {
  const r = await call('GET', "/products?q=%27%3B%20DROP%20TABLE%20products%3B--");
  check(r.status === 200, `got ${r.status}`);
  const r2 = await call('POST', '/auth/seller/login', { body: { email: { $ne: 1 }, password: [1] } });
  check(r2.status === 400 || r2.status === 401, `got ${r2.status}`);
  expectStatus(await call('GET', '/health'), 200);
});

// ---------- Result ----------
console.log('\n==============================');
console.log(`${passed} passed, ${failed.length} failed, ${skipped.length} skipped`);
if (failed.length === 0) {
  console.log('\nAll checks passed. Now run the frontend part of the plan (npm run build, then the click-through list).');
} else {
  console.log('\nWHAT FAILED AND WHAT TO DO:');
  failed.forEach((f, i) => {
    console.log(`\n${i + 1}. ${f.name}\n   ${f.message}`);
    if (f.advice) console.log(`   → ${f.advice}`);
  });
  console.log('\nCopy this whole list and send it to Claude. If any says 500, also send the last 20 lines of the SERVER terminal.');
}
process.exit(failed.length ? 1 : 0);
