// "amina.wanjiru@gmail.com" -> "a••••••@gmail.com": enough for a person to recognise their own email.
export function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return '';
  return `${e[0]}${'•'.repeat(Math.min(6, Math.max(2, at - 1)))}${e.slice(at)}`;
}
