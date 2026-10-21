export const categories = [
  { id: "fashion", name: "Fashion", emoji: "👗" },
  { id: "electronics", name: "Electronics", emoji: "🎧" },
  { id: "phones", name: "Phones", emoji: "📱" },
  { id: "home", name: "Home", emoji: "🏠" },
  { id: "beauty", name: "Beauty", emoji: "🧴" },
  { id: "groceries", name: "Groceries", emoji: "🍯" },
];

// opens and closes are 24-hour times. lat and lng place the shop on the map.
export const shops = [
  {
    id: "s1", name: "Nairobi Threads", areaId: "westlands", area: "Westlands", town: "Nairobi", lat: -1.268, lng: 36.811,
    opens: "08:00", closes: "19:00", verified: true, rating: 4.7, reviews: 128, since: 2023,
    description: "Everyday and occasion wear from local designers. Ankara, denim and shoes.",
    fulfillment: ["delivery", "pickup"],
  },
  {
    id: "s2", name: "Kilimani Tech Hub", areaId: "kilimani", area: "Kilimani", town: "Nairobi", lat: -1.291, lng: 36.786,
    opens: "09:00", closes: "20:00", verified: true, rating: 4.5, reviews: 86, since: 2024,
    description: "Phone accessories, audio and smart home gadgets, tested before they ship.",
    fulfillment: ["delivery", "pickup"],
  },
  {
    id: "s3", name: "Karen Crafts & Pantry", areaId: "karen", area: "Karen", town: "Nairobi", lat: -1.3195, lng: 36.711,
    opens: "08:00", closes: "17:00", verified: true, rating: 4.8, reviews: 203, since: 2022,
    description: "Handmade crafts, natural beauty products and farm-fresh pantry items.",
    fulfillment: ["pickup"],
  },
  {
    id: "s4", name: "Nyali Beach Bazaar", areaId: "nyali", area: "Nyali", town: "Mombasa", lat: -4.021, lng: 39.716,
    opens: "09:00", closes: "18:00", verified: true, rating: 4.6, reviews: 64, since: 2024,
    description: "Beach and coast favourites: towels, coconut oil and island gifts.",
    fulfillment: ["delivery", "pickup"],
  },
];

const daysAgo = (n) => Date.now() - n * 24 * 60 * 60 * 1000;

export const products = [
  { id: "p1", addedAt: daysAgo(40), sold: 96, name: "Ankara Maxi Dress", price: 2800, category: "fashion", emoji: "👗", hue: 25, rating: 4.8, shopId: "s1", stock: 12, description: "Flowing maxi dress in bold Ankara print. Lined, with side pockets. Available in sizes S to XL." },
  { id: "p2", addedAt: daysAgo(30), sold: 41, name: "Leather Sneakers", price: 4500, category: "fashion", emoji: "👟", hue: 200, rating: 4.6, shopId: "s1", stock: 4, description: "Genuine leather sneakers with a cushioned sole. Clean white finish that goes with everything." },
  { id: "p3", addedAt: daysAgo(21), sold: 210, name: "Wireless Earbuds", price: 3200, category: "electronics", emoji: "🎧", hue: 260, rating: 4.5, shopId: "s2", stock: 25, description: "Bluetooth 5.3 earbuds with a charging case and up to 20 hours of total playtime." },
  { id: "p4", addedAt: daysAgo(12), sold: 58, name: "Smart LED Bulb Set", price: 1800, category: "electronics", emoji: "💡", hue: 50, rating: 4.4, shopId: "s2", stock: 9, description: "Set of two colour-changing bulbs you control from your phone. E27 fitting." },
  { id: "p5", addedAt: daysAgo(8), sold: 132, name: "Kiondo Basket", price: 1500, category: "home", emoji: "🧺", hue: 30, rating: 4.9, shopId: "s3", stock: 7, description: "Hand-woven kiondo with a leather strap. Strong, stylish and made by local weavers." },
  { id: "p6", addedAt: daysAgo(5), sold: 175, name: "Shea Body Butter", price: 950, category: "beauty", emoji: "🧴", hue: 340, rating: 4.7, shopId: "s3", stock: 30, description: "Rich, unscented shea butter for dry skin. 250g jar, no added colour." },
  { id: "p7", addedAt: daysAgo(3), sold: 88, name: "Rift Valley Honey 1kg", price: 1200, category: "groceries", emoji: "🍯", hue: 45, rating: 4.8, shopId: "s3", stock: 18, description: "Raw, unprocessed honey from Rift Valley beekeepers. 1kg jar." },
  { id: "p8", addedAt: daysAgo(2), sold: 120, name: "Power Bank 20000mAh", price: 2600, category: "electronics", emoji: "🔋", hue: 140, rating: 4.5, shopId: "s2", stock: 0, description: "Fast-charging power bank with two USB ports and a USB-C port. Charges a phone about five times." },
  { id: "p9", addedAt: daysAgo(1), sold: 34, name: "Coastal Beach Towel", price: 800, category: "home", emoji: "🏖️", hue: 190, rating: 4.6, shopId: "s4", stock: 20, description: "Large, quick-dry beach towel in bright coastal stripes." },
  { id: "p10", addedAt: daysAgo(1), sold: 61, name: "Coconut Oil 500ml", price: 650, category: "beauty", emoji: "🥥", hue: 95, rating: 4.7, shopId: "s4", stock: 15, description: "Cold-pressed coconut oil for skin and hair, from the Kenyan coast." },
];
