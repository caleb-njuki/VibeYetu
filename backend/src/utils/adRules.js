// Ad rules. Same numbers and checks as the frontend (src/lib/ads.js).
export const PRICE_PER_DAY = 20;
export const DURATIONS = [1, 3, 7, 14];
export const REPORT_LIMIT = 3; // different buyers who must report an ad before it hides itself
export const MAX_LIVE_ADS = 6; // slides shown at once
export const MAX_OPEN_ADS_PER_SHOP = 10; // waiting, scheduled or live ads one shop may have
export const REPORT_REASONS = ['Misleading', 'Offensive', 'Spam'];
export const DAY_SECONDS = 24 * 60 * 60;
export const MIN_CONTRAST = 3;

const BLOCKED_WORDS = ['scam', 'fake', 'free money', 'get rich', 'guaranteed win', 'casino', 'betting'];

export const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// How readable a colour is on a white ad: 1 (invisible) to 21 (black).
export const contrastOnWhite = (hex) => (isHexColor(hex) ? 1.05 / (luminance(hex) + 0.05) : 0);

// The text checks. Returns a sentence describing the problem, or null when the text is fine.
export function textIssue(headline, subtext) {
  const text = `${headline} ${subtext}`.toLowerCase();
  if (BLOCKED_WORDS.some((w) => text.includes(w))) return 'The text has a word that is not allowed in ads.';
  if (/(https?:|www\.|\.com|\.co\.ke)/.test(text) || /\d[\d\s-]{7,}\d/.test(text)) return 'Ads cannot contain links or phone numbers.';
  return null;
}
