// Shop-name rules. Same rules as the frontend (src/lib/sellers.js).
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 &'.-]*$/;
const RESERVED_CONTAINS = ['vibeyetu', 'safaricom', 'mpesa'];
const RESERVED_EXACT = ['admin', 'support', 'official', 'help', 'escrow', 'kra'];

// "Nairobi  Threads!", "nairobi-threads" and "NAIROBI THREADS" all become "nairobithreads".
export function nameKey(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '');
}

// Checks the rules that do not need the database.
// Returns { ok: true, name, key } or { ok: false, message }.
export function checkShopNameRules(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < 3) return { ok: false, message: 'A shop name needs at least 3 characters.' };
  if (name.length > 40) return { ok: false, message: 'A shop name can have at most 40 characters.' };
  if (!NAME_RE.test(name)) return { ok: false, message: "Use letters, numbers, spaces and & ' . - only." };
  const key = nameKey(name);
  if (key.length < 3) return { ok: false, message: 'A shop name needs at least 3 letters or numbers.' };
  if (RESERVED_EXACT.includes(key) || RESERVED_CONTAINS.some((w) => key.includes(w))) {
    return { ok: false, message: 'That name is reserved. Please choose another.' };
  }
  return { ok: true, name, key };
}
