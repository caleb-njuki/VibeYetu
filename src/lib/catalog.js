// Products added or edited by sellers, kept in the browser for the demo.
// The backend database owns this later; the pages keep calling the same functions.
const KEY = "vibeyetu_catalog";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      edits: parsed.edits && typeof parsed.edits === "object" && !Array.isArray(parsed.edits) ? parsed.edits : {},
    };
  } catch {
    return { custom: [], edits: {} };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: changes last only for this visit.
  }
}

// Base products plus seller-added ones, with seller edits applied.
export function applyCatalog(base) {
  const { custom, edits } = read();
  return [...base, ...custom].map((p) => (edits[p.id] ? { ...p, ...edits[p.id] } : p));
}

export function newProductId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function createProduct(product) {
  const state = read();
  state.custom.push(product);
  write(state);
}

export function updateProduct(id, fields) {
  const state = read();
  state.edits[id] = { ...(state.edits[id] || {}), ...fields };
  write(state);
}
