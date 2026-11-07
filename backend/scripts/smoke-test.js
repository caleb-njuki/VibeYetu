// Tests the RUNNING backend from start to finish and prints one line per check.
// Start the server first (npm run dev, in its own terminal), then in a second terminal:
//   cd backend
//   node scripts/smoke-test.js
// It makes test accounts with "smoke" in their names. They are harmless.
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const BASE = `${process.env.API_URL || 'http://localhost:5000'}/api`;
const NEAR_CBD = 'lat=-1.2864&lng=36.8172&radiusKm=15'; // Nairobi CBD, 15 km
const NEAR_MOMBASA = 'lat=-4.02&lng=39.7173&radiusKm=15';

let passed = 0;

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    console.log(`\n✘ Cannot reach the server at ${BASE}`);
    console.log('  Is "npm run dev" running in another terminal, showing "Database: connected"?');
    process.exit(1);
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // The reply was not JSON.
  }
  return { status: response.status, data };
}

function expectStatus(res, status) {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status} but got ${res.status}. The server said: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(name, work) {
  try {
    const note = await work();
    passed += 1;
    console.log(`✔ ${name}${note ? `  (${note})` : ''}`);
  } catch (err) {
    console.log(`\n✘ ${name}\n  ${err.message}\n`);
    console.log(`Stopped after ${passed} passed check(s). Copy everything above and send it to Claude.`);
    process.exit(1);
  }
}

const stamp = Date.now();
const email = `smoke${stamp}@test.com`;
const password = 'Passw0rd123';
const shopName = `Smoke Shop ${stamp.toString(36)}`;
const phone = `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
let sellerToken;
let shopId;
let productId;
let buyerToken;

console.log(`Testing ${BASE}\n`);

// ---- Server and lists ----
await step('Server and database are up', async () => {
  const data = expectStatus(await call('GET', '/health'), 200);
  check(data.status === 'ok', `health says ${JSON.stringify(data)}`);
});
await step('13 areas', async () => {
  const data = expectStatus(await call('GET', '/areas'), 200);
  check(data.areas.length === 13, `found ${data.areas.length} areas. Did the migrations run? (node src/migrate.js)`);
});
await step('6 categories', async () => {
  const data = expectStatus(await call('GET', '/categories'), 200);
  check(data.categories.length === 6, `found ${data.categories.length} categories. Did migration 003 run? (node src/migrate.js)`);
});

// ---- Seller ----
await step('Seller signs up (with the first shop)', async () => {
  const data = expectStatus(
    await call('POST', '/auth/seller/register', {
      body: {
        account: { email, password },
        details: { fullName: 'Smoke Tester', idNumber: '29384756', kraPin: '', phone, businessType: 'individual', businessName: '', businessRegNo: '' },
        shop: { name: shopName, areaId: 'westlands', description: 'A shop made by the smoke test' },
        consent: { terms: true, data: true, accurate: true },
      },
    }),
    201
  );
  check(data.token && data.shop?.id, 'no token or shop came back');
  shopId = data.shop.id;
  return `shop ${shopId}`;
});
await step('Seller cannot sign in with a wrong password', async () => {
  expectStatus(await call('POST', '/auth/seller/login', { body: { email, password: 'wrongpass123' } }), 401);
});
await step('Seller signs in', async () => {
  const data = expectStatus(await call('POST', '/auth/seller/login', { body: { email, password } }), 200);
  check(data.token, 'no token came back');
  sellerToken = data.token;
});
await step('Seller is refused without a token', async () => {
  expectStatus(await call('GET', `/seller/shops/${shopId}/products`), 401);
});

// ---- Products ----
await step('A bad product (price 0) is refused with a clear message', async () => {
  const res = await call('POST', `/seller/shops/${shopId}/products`, {
    token: sellerToken,
    body: { name: 'Bad Product', price: 0, stock: 1, category: 'home' },
  });
  expectStatus(res, 400);
  return res.data.error;
});
await step('Seller adds a product', async () => {
  const data = expectStatus(
    await call('POST', `/seller/shops/${shopId}/products`, {
      token: sellerToken,
      body: { name: 'Smoke Kiondo Basket', price: 1500, stock: 7, category: 'home', description: 'Hand woven basket' },
    }),
    201
  );
  productId = data.product.id;
  return `product ${productId}`;
});
await step('Seller sees the product in their list', async () => {
  const data = expectStatus(await call('GET', `/seller/shops/${shopId}/products`, { token: sellerToken }), 200);
  check(data.products.some((p) => p.id === productId), 'the new product is not in the list');
});

// ---- What buyers see ----
await step('Search finds the product near Nairobi CBD', async () => {
  const data = expectStatus(await call('GET', `/products?q=smoke%20kiondo&${NEAR_CBD}`), 200);
  const found = data.products.find((p) => p.id === productId);
  check(found, 'the product was not found. Is the shop in Westlands, and the product switched on?');
  check(typeof found.shop.distanceKm === 'number' && found.shop.distanceKm < 5, `distance looks wrong: ${found.shop.distanceKm}`);
  return `${found.shop.distanceKm} km away`;
});
await step('Search does NOT find it near Mombasa', async () => {
  const data = expectStatus(await call('GET', `/products?q=smoke%20kiondo&${NEAR_MOMBASA}`), 200);
  check(!data.products.some((p) => p.id === productId), 'a Nairobi product showed up in Mombasa');
});
await step('Home page lists the product and the shop', async () => {
  const data = expectStatus(await call('GET', `/home?${NEAR_CBD}`), 200);
  check(data.newArrivals.some((p) => p.id === productId), 'the product is not in newArrivals');
  check(data.shops.some((s) => s.id === shopId), 'the shop is not in the nearby shops');
});
await step('Product page works', async () => {
  const data = expectStatus(await call('GET', `/products/${productId}?${NEAR_CBD}`), 200);
  check(data.product.shop.id === shopId, 'the product has the wrong shop');
});
await step('Related products work', async () => {
  const data = expectStatus(await call('GET', `/products/${productId}/related?${NEAR_CBD}`), 200);
  check(Array.isArray(data.fromShop) && Array.isArray(data.similar), 'the answer has the wrong shape');
});
await step('Shop page works', async () => {
  const data = expectStatus(await call('GET', `/shops/${shopId}?${NEAR_CBD}`), 200);
  check(data.shop.products.some((p) => p.id === productId), 'the shop page does not list the product');
});
await step('A hidden product disappears from search, and returns when switched on', async () => {
  expectStatus(await call('PATCH', `/seller/shops/${shopId}/products/${productId}`, { token: sellerToken, body: { active: false } }), 200);
  const hidden = expectStatus(await call('GET', `/products?q=smoke%20kiondo&${NEAR_CBD}`), 200);
  check(!hidden.products.some((p) => p.id === productId), 'the hidden product still shows in search');
  expectStatus(await call('PATCH', `/seller/shops/${shopId}/products/${productId}`, { token: sellerToken, body: { active: true } }), 200);
  const shown = expectStatus(await call('GET', `/products?q=smoke%20kiondo&${NEAR_CBD}`), 200);
  check(shown.products.some((p) => p.id === productId), 'the product did not come back');
});

// ---- Photos ----
await step('Photo upload permission', async () => {
  const res = await call('POST', `/seller/shops/${shopId}/images/signature`, { token: sellerToken });
  if (res.status === 503) return 'Cloudinary is not set up yet, which is fine for now';
  expectStatus(res, 200);
  check(res.data.signature && res.data.uploadUrl, 'the answer has no signature');
  return 'Cloudinary is set up';
});

// ---- Buyer ----
await step('Buyer asks for a code', async () => {
  expectStatus(await call('POST', '/auth/buyer/request-otp', { body: { phone } }), 200);
});

console.log(`\n   Look at the SERVER terminal. Find the line "[DEV SMS] To +254${phone.slice(1)}: Your VibeYetu code is XXXXXX".`);
const rl = readline.createInterface({ input: stdin, output: stdout });
const code = (await rl.question('   Type the 6 digits here and press Enter: ')).trim();
rl.close();
console.log('');

await step('Buyer signs in with the code', async () => {
  const data = expectStatus(await call('POST', '/auth/buyer/verify-otp', { body: { phone, code } }), 200);
  check(data.token, 'no token came back');
  buyerToken = data.token;
});
await step('Buyer profile works', async () => {
  expectStatus(await call('GET', '/auth/buyer/me', { token: buyerToken }), 200);
});
await step('A seller token does not work as a buyer', async () => {
  expectStatus(await call('GET', '/favourites', { token: sellerToken }), 401);
});
await step('Buyer saves a favourite', async () => {
  expectStatus(await call('PUT', `/favourites/${productId}`, { token: buyerToken }), 200);
  const data = expectStatus(await call('GET', '/favourites', { token: buyerToken }), 200);
  check(data.products.some((p) => p.id === productId), 'the favourite is not in the list');
});
await step('Buyer removes the favourite', async () => {
  expectStatus(await call('DELETE', `/favourites/${productId}`, { token: buyerToken }), 200);
  const data = expectStatus(await call('GET', '/favourites', { token: buyerToken }), 200);
  check(data.products.length === 0, 'the favourite is still in the list');
});

console.log(`\nALL ${passed} CHECKS PASSED. The backend works from start to finish.`);
