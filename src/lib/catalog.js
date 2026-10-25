// Products added or edited by sellers, kept in the browser for the demo.
// The backend database owns this later; the pages keep calling the same functions.
const KEY = "vibeyetu_catalog";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      edits: parsed.edits && typeof parsed.edits === "object" && !Array.isArray(parsed.edits) ? parsed.edits : {},
      removed: Array.isArray(parsed.removed) ? parsed.removed : [],
    };
  } catch {
    return { custom: [], edits: {}, removed: [] };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: changes last only for this visit.
  }
}

// Base products plus seller-added ones, with seller edits applied and deleted ones left out.
export function applyCatalog(base) {
  const { custom, edits, removed } = read();
  const gone = new Set(removed);
  return [...base, ...custom].filter((p) => !gone.has(p.id)).map((p) => (edits[p.id] ? { ...p, ...edits[p.id] } : p));
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

// Deleting a sample product only hides it for good. A seller's own product is removed outright.
export function removeProduct(id) {
  const state = read();
  state.custom = state.custom.filter((p) => p.id !== id);
  delete state.edits[id];
  if (!state.removed.includes(id)) state.removed.push(id);
  write(state);
}
