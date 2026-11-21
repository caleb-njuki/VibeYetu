// Turns what a person types into one standard format, for example +254712345678.
// Returns null if the number does not look valid.
export function normalizePhone(input) {
  if (typeof input !== 'string') return null;

  let p = input.replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;

  if (/^0[17]\d{8}$/.test(p)) p = `+254${p.slice(1)}`; // 0712345678
  else if (/^[17]\d{8}$/.test(p)) p = `+254${p}`; // 712345678
  else if (/^254[17]\d{8}$/.test(p)) p = `+${p}`; // 254712345678

  // Kenyan numbers must be exactly +254 followed by 9 digits starting with 7 or 1.
  if (p.startsWith('+254')) return /^\+254[17]\d{8}$/.test(p) ? p : null;

  // Other countries: standard international format.
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

// For a number someone has just typed in a form: exactly 10 digits, starting with 0 (07... or 01...).
// Returns +254712345678, or null. Numbers that are already saved are read with normalizePhone above.
export function normalizeTyped(input) {
  const p = typeof input === 'string' ? input.trim() : '';
  return /^0[17]\d{8}$/.test(p) ? `+254${p.slice(1)}` : null;
}
