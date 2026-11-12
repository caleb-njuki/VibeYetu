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

// ---- Orders and escrow (payment is simulated) ----
let groupId;
let orderId;
let orderCode;
await step('Buyer checks out (pickup): stock is held and the price comes from the server', async () => {
  const data = expectStatus(
    await call('POST', '/checkout', {
      token: buyerToken,
      body: { items: [{ productId, qty: 2 }], modes: { [shopId]: 'pickup' }, contact: { name: 'Smoke Buyer', phone } },
    }),
    201
  );
  groupId = data.checkout.id;
  orderId = data.checkout.orders[0].id;
  check(data.checkout.total === 3000, `expected total 3000 but got ${data.checkout.total}`);
  const list = expectStatus(await call('GET', `/seller/shops/${shopId}/products`, { token: sellerToken }), 200);
  const stock = list.products.find((p) => p.id === productId).stock;
  check(stock === 5, `stock should be 5 (7 minus 2 held) but is ${stock}`);
  return `order ${orderId}`;
});
await step('Buyer pays (simulated): the order goes to the seller', async () => {
  const data = expectStatus(await call('POST', `/checkout/${groupId}/pay`, { token: buyerToken, body: { method: 'card' } }), 200);
  check(data.orders[0].status === 'pending', `status is ${data.orders[0].status}`);
  const list = expectStatus(await call('GET', `/seller/shops/${shopId}/orders`, { token: sellerToken }), 200);
  check(list.orders.some((o) => o.id === orderId), 'the seller does not see the order');
});
await step('Seller agrees to fulfil and sees the code', async () => {
  const data = expectStatus(await call('POST', `/seller/shops/${shopId}/orders/${orderId}/accept`, { token: sellerToken, body: { promise: '3h' } }), 200);
  check(data.order.status === 'accepted' && /^\d{6}$/.test(data.order.code), 'the order is not accepted or has no code');
  orderCode = data.order.code;
});
await step('A wrong code is refused', async () => {
  const wrong = orderCode === '111111' ? '222222' : '111111';
  expectStatus(await call('POST', `/seller/shops/${shopId}/orders/${orderId}/dispatch`, { token: sellerToken, body: { code: wrong } }), 400);
});
await step('Seller dispatches with the code', async () => {
  const data = expectStatus(await call('POST', `/seller/shops/${shopId}/orders/${orderId}/dispatch`, { token: sellerToken, body: { code: orderCode } }), 200);
  check(data.order.status === 'dispatched', `status is ${data.order.status}`);
});
await step('Buyer confirms with the code: the payment is released', async () => {
  const mine = expectStatus(await call('GET', `/orders/${orderId}`, { token: buyerToken }), 200);
  check(mine.order.code === orderCode, 'the buyer cannot see the code once the order is dispatched');
  const data = expectStatus(await call('POST', `/orders/${orderId}/confirm`, { token: buyerToken, body: { code: orderCode } }), 200);
  check(data.order.status === 'completed', `status is ${data.order.status}`);
});
await step('A second confirm is refused (no double release)', async () => {
  expectStatus(await call('POST', `/orders/${orderId}/confirm`, { token: buyerToken, body: { code: orderCode } }), 409);
});
await step('Orders are refused without a token', async () => {
  expectStatus(await call('GET', `/seller/shops/${shopId}/orders`), 401);
  expectStatus(await call('GET', '/orders'), 401);
});

// ---- Ratings and notifications ----
await step('Buyer rates the product and the shop', async () => {
  expectStatus(await call('POST', `/orders/${orderId}/rating`, { token: buyerToken, body: { kind: 'product', productId, stars: 4, comment: 'Lovely basket' } }), 201);
  expectStatus(await call('POST', `/orders/${orderId}/rating`, { token: buyerToken, body: { kind: 'shop', stars: 5 } }), 201);
});
await step('Rating the same thing twice is refused', async () => {
  expectStatus(await call('POST', `/orders/${orderId}/rating`, { token: buyerToken, body: { kind: 'shop', stars: 1 } }), 409);
});
await step('The product page now shows the rating and the sold count', async () => {
  const data = expectStatus(await call('GET', `/products/${productId}?${NEAR_CBD}`), 200);
  check(data.product.rating === 4 && data.product.ratingCount === 1, `rating is ${data.product.rating} from ${data.product.ratingCount}`);
  check(data.product.sold === 2, `sold should be 2 but is ${data.product.sold}`);
  check(data.product.shop.rating === 5 && data.product.shop.reviews === 1, 'the shop rating is wrong');
});
await step('Public reviews show stars and comment, no names', async () => {
  const data = expectStatus(await call('GET', `/products/${productId}/reviews`), 200);
  check(data.count === 1 && data.reviews[0].comment === 'Lovely basket', 'the review is missing');
  check(!JSON.stringify(data).includes(phone), 'a phone number leaked into the reviews');
});
await step('The home page lists the product as a best seller', async () => {
  const data = expectStatus(await call('GET', `/home?${NEAR_CBD}`), 200);
  check(data.bestSellers.some((p) => p.id === productId), 'the product is not in bestSellers');
});
await step('Seller bell: the new order and the buyer\'s confirmation', async () => {
  const data = expectStatus(await call('GET', `/seller/shops/${shopId}/notifications`, { token: sellerToken }), 200);
  check(data.items.length >= 3, `expected at least 3 notifications but found ${data.items.length}`);
  check(data.unreadCount === data.items.length, 'they should all be unread');
  const done = expectStatus(await call('POST', `/seller/shops/${shopId}/notifications/read`, { token: sellerToken, body: { all: true } }), 200);
  check(done.unreadCount === 0, 'mark all read did not work');
});
await step('Buyer bell: seller agreed and dispatched', async () => {
  const data = expectStatus(await call('GET', '/notifications', { token: buyerToken }), 200);
  check(data.items.length === 2 && data.unreadCount === 2, `expected 2 unread but found ${data.items.length} (${data.unreadCount} unread)`);
  const done = expectStatus(await call('POST', '/notifications/read', { token: buyerToken, body: { ids: [data.items[0].id] } }), 200);
  check(done.unreadCount === 1, 'marking one as read did not work');
});

// ---- Help assistant ----
let assistantSource = 'canned';
await step('Assistant answers a question about refunds', async () => {
  const data = expectStatus(await call('POST', '/assistant', { body: { message: 'How do refunds work?', lang: 'en' } }), 200);
  check(typeof data.reply === 'string' && data.reply.length > 20, 'the reply is empty');
  check(['ai', 'canned'].includes(data.source), `unexpected source ${data.source}`);
  assistantSource = data.source;
  return data.source === 'ai' ? 'answered by the AI' : 'answered from built-in answers (no AI key set, which is fine)';
});
await step('Assistant answers in Swahili', async () => {
  const data = expectStatus(await call('POST', '/assistant', { body: { message: 'Escrow ni nini?', lang: 'sw' } }), 200);
  check(data.reply.length > 20, 'the reply is empty');
});
await step('Assistant refuses a PIN or code and does not send it anywhere', async () => {
  const data = expectStatus(await call('POST', '/assistant', { body: { message: 'my M-Pesa pin is 4821', lang: 'en' } }), 200);
  check(data.source === 'guard', `expected the guard but got ${data.source}`);
});
await step('Assistant works for a logged-in buyer (knows their orders)', async () => {
  const data = expectStatus(await call('POST', '/assistant', { token: buyerToken, body: { message: 'Where is my order?', lang: 'en' } }), 200);
  check(data.reply.length > 20, 'the reply is empty');
});
await step('An empty question is refused', async () => {
  expectStatus(await call('POST', '/assistant', { body: { message: '   ' } }), 400);
});

// ---- Offers and closing ----
await step('Seller: a bad offer is refused, a good one lowers the price buyers see, deleting it puts the price back', async () => {
  const day = 24 * 3600 * 1000;
  const good = { name: 'Smoke sale', percent: 20, productIds: 'all', startsAt: Date.now() - 1000, endsAt: Date.now() + day };
  expectStatus(await call('POST', `/seller/shops/${shopId}/offers`, { token: sellerToken, body: { ...good, percent: 99 } }), 400);
  const made = expectStatus(await call('POST', `/seller/shops/${shopId}/offers`, { token: sellerToken, body: good }), 201);
  check(made.offer.state === 'live', `the offer should be live but is "${made.offer.state}"`);
  const now = expectStatus(await call('GET', `/products/${productId}?${NEAR_CBD}`), 200);
  check(now.product.price === 1200 && now.product.originalPrice === 1500 && now.product.discountPercent === 20, `expected 1200 (was 1500, 20% off) but got ${JSON.stringify([now.product.price, now.product.originalPrice, now.product.discountPercent])}`);
  const home = expectStatus(await call('GET', `/home?${NEAR_CBD}`), 200);
  check(home.offers.some((p) => p.id === productId), 'the discounted product is not in the home offers');
  expectStatus(await call('DELETE', `/seller/shops/${shopId}/offers/${made.offer.id}`, { token: sellerToken }), 200);
  const back = expectStatus(await call('GET', `/products/${productId}?${NEAR_CBD}`), 200);
  check(back.product.price === 1500 && back.product.originalPrice === undefined, 'the price did not go back to 1500');
});
await step('Seller: closing the shop needs the right password (the shop is NOT closed by this test)', async () => {
  const info = expectStatus(await call('GET', `/seller/shops/${shopId}/closure`, { token: sellerToken }), 200);
  check(typeof info.canClose === 'boolean' && typeof info.products === 'number', 'the closing summary has the wrong shape');
  expectStatus(await call('POST', `/seller/shops/${shopId}/close`, { token: sellerToken, body: { reason: 'Not enough sales', password: 'definitely-wrong-1' } }), 401);
  expectStatus(await call('POST', `/seller/shops/${shopId}/close`, { token: sellerToken, body: { reason: 'Boredom', password: 'definitely-wrong-1' } }), 400);
});

// ---- Payout method, shop photo ----
await step('Seller: a payout method cannot be saved without a code from SMS (the code is printed in the server terminal)', async () => {
  const mine = { method: 'till', till: '5123456' };
  const empty = expectStatus(await call('GET', `/seller/shops/${shopId}/payout`, { token: sellerToken }), 200);
  check(empty.payout === null, 'a new shop should have no payout method yet');
  expectStatus(await call('POST', `/seller/shops/${shopId}/payout/code`, { token: sellerToken, body: { method: 'till', till: '12' } }), 400);
  const sent = expectStatus(await call('POST', `/seller/shops/${shopId}/payout/code`, { token: sellerToken, body: mine }), 200);
  check(/^0\d•• ••• \d{3}$/.test(sent.phone), `the masked phone looks wrong: ${sent.phone}`);
  expectStatus(await call('PUT', `/seller/shops/${shopId}/payout`, { token: sellerToken, body: mine }), 410); // not verified yet
  expectStatus(await call('POST', `/seller/shops/${shopId}/payout/verify`, { token: sellerToken, body: { code: '000000' } }), 400);
});
await step('Seller: a shop photo from another shop is refused', async () => {
  expectStatus(await call('PATCH', `/seller/shops/${shopId}`, { token: sellerToken, body: { photo: 'vibeyetu/shops/99999999/abc' } }), 400);
});

// ---- Ads ----
let adId;
await step('Seller: a bad ad is refused (headline too short, colour too light)', async () => {
  const good = { headline: 'Smoke test sale', subtext: 'Fresh stock this week', headlineColor: '#17181c', subtextColor: '#4b5563', target: 'shop', days: 3 };
  expectStatus(await call('POST', `/seller/shops/${shopId}/ads`, { body: good }), 401);
  expectStatus(await call('POST', `/seller/shops/${shopId}/ads`, { token: sellerToken, body: { ...good, headline: 'Hi' } }), 400);
  expectStatus(await call('POST', `/seller/shops/${shopId}/ads`, { token: sellerToken, body: { ...good, headlineColor: '#ffffff' } }), 400);
});
await step('Seller buys an ad (simulated payment): the price comes from the server and it goes live', async () => {
  const data = expectStatus(await call('POST', `/seller/shops/${shopId}/ads`, { token: sellerToken, body: { headline: 'Smoke test sale', subtext: 'Fresh stock this week', headlineColor: '#17181c', subtextColor: '#4b5563', target: 'shop', days: 3, total: 1 } }), 201);
  adId = data.ad.id;
  check(data.ad.total === 60, `3 days should cost 60 but the ad says ${data.ad.total}`);
  check(data.ad.state === 'live', `the ad should be live but is "${data.ad.state}": ${data.ad.issue}`);
  return adId;
});
await step('Buyers near the shop see the ad on the home slideshow, and not in Mombasa', async () => {
  const near = expectStatus(await call('GET', `/ads?${NEAR_CBD}`), 200);
  const ad = near.ads.find((a) => a.id === adId);
  check(Boolean(ad), 'the ad is not in the slideshow');
  check(ad.to === `/shop/${shopId}` && !('total' in ad), 'the ad link is wrong or a private field is showing');
  const far = expectStatus(await call('GET', `/ads?${NEAR_MOMBASA}`), 200);
  check(!far.ads.some((a) => a.id === adId), 'a Nairobi ad showed up in Mombasa');
});
await step('Buyer reports an ad once; a second report is refused', async () => {
  expectStatus(await call('POST', `/ads/${adId}/report`, { body: { reason: 'Spam' } }), 401);
  expectStatus(await call('POST', `/ads/${adId}/report`, { token: buyerToken, body: { reason: 'Rude' } }), 400);
  expectStatus(await call('POST', `/ads/${adId}/report`, { token: buyerToken, body: { reason: 'Spam' } }), 200);
  expectStatus(await call('POST', `/ads/${adId}/report`, { token: buyerToken, body: { reason: 'Spam' } }), 409);
});

// ---- Staff tools and suspension ----
await step('Staff routes are closed without a staff token', async () => {
  expectStatus(await call('GET', '/admin/overview'), 401);
  expectStatus(await call('GET', '/admin/overview', { token: sellerToken }), 401); // a seller token is not a staff token
  expectStatus(await call('POST', '/auth/admin/login', { body: { email: 'nobody@example.com', password: 'wrong-password-123' } }), 401);
});
await step('Seller: a shop that is not suspended has no report to write', async () => {
  const data = expectStatus(await call('GET', `/seller/shops/${shopId}/suspension`, { token: sellerToken }), 200);
  check(data.suspended === false, 'the shop should not be suspended');
  expectStatus(await call('POST', `/seller/shops/${shopId}/suspension/report`, { token: sellerToken, body: { reason: 'Something else', details: 'x'.repeat(40), plan: 'y'.repeat(30) } }), 409);
});
const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  let adminToken;
  await step('Staff sign in', async () => {
    const data = expectStatus(await call('POST', '/auth/admin/login', { body: { email: adminEmail, password: adminPassword } }), 200);
    adminToken = data.token;
    check(Boolean(adminToken), 'no token came back');
  });
  await step('Staff overview, orders, cases and shops', async () => {
    const ov = expectStatus(await call('GET', '/admin/overview', { token: adminToken }), 200);
    check(ov.byStatus && ov.released.total >= 3000, `released total should include our 3000 order but is ${ov.released?.total}`);
    const orders = expectStatus(await call('GET', `/admin/orders?q=${orderId}`, { token: adminToken }), 200);
    check(orders.orders.length === 1 && orders.orders[0].status === 'completed', 'our order is not listed as completed');
    expectStatus(await call('GET', '/admin/cases', { token: adminToken }), 200);
    const shops = expectStatus(await call('GET', '/admin/shops', { token: adminToken }), 200);
    const mine = shops.shops.find((x) => x.id === shopId);
    check(Boolean(mine) && !JSON.stringify(mine).includes('29384756'), 'our shop is missing, or the full ID number is visible');
  });
  await step('Staff can mark a shop verified and take it back', async () => {
    expectStatus(await call('POST', `/admin/shops/${shopId}/verify`, { token: adminToken, body: { verified: true } }), 200);
    const data = expectStatus(await call('GET', `/shops/${shopId}?${NEAR_CBD}`), 200);
    check(data.shop.verified === true, 'the shop page does not show the verified mark');
    expectStatus(await call('POST', `/admin/shops/${shopId}/verify`, { token: adminToken, body: { verified: false } }), 200);
  });
  await step('Staff see the ads list and can take an ad down', async () => {
    const list = expectStatus(await call('GET', '/admin/ads', { token: adminToken }), 200);
    const mine = list.ads.find((a) => a.id === adId);
    check(Boolean(mine) && mine.reports.length === 1, 'our ad is missing or its report is not listed');
    expectStatus(await call('POST', `/admin/ads/${adId}/stop`, { token: adminToken }), 200);
    const after = expectStatus(await call('GET', `/ads?${NEAR_CBD}`), 200);
    check(!after.ads.some((a) => a.id === adId), 'the stopped ad is still in the slideshow');
  });
} else {
  console.log('  (skipped the staff sign-in checks: set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to run them)');
}

console.log(`\nALL ${passed} CHECKS PASSED. The backend works from start to finish.`);
