// "+254712345678" -> "07•• ••• 678": enough for a person to recognise their own phone (same as the frontend).
export function maskPhone(phone) {
  const p = String(phone || '');
  if (!/^\+\d{8,15}$/.test(p)) return '';
  const local = p.startsWith('+254') ? `0${p.slice(4)}` : p;
  return `${local.slice(0, 2)}•• ••• ${local.slice(-3)}`;
}
