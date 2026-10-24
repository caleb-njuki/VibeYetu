// Reports sellers write after a suspension, and the notices that tell them what to do.
// Kept in the browser for the demo. The backend database owns this later.
import { allShopFlags, getShopFlags, reinstateShop } from "./shopFlags.js";

const REPORTS_KEY = "vibeyetu_suspension_reports";
const NOTICES_KEY = "vibeyetu_shop_notices";

export const REPORT_REASONS = [
  "I ran out of stock",
  "I was closed or away",
  "I could not arrange delivery",
  "My phone or network failed",
  "The buyer could not be reached",
  "Something else",
];

function read(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---- Notices (they show in the seller's notification bell) ----
export function addNotice(shopId, { text, href = "/my-shop/report" }) {
  write(NOTICES_KEY, [{ id: newId("n"), shopId, at: Date.now(), text, href }, ...read(NOTICES_KEY)].slice(0, 200));
}

export const listNotices = (shopId) => read(NOTICES_KEY).filter((n) => n.shopId === shopId);

// ---- Reports ----
// A report belongs to one suspension (identified by when it started), so a shop that is
// suspended a second time has to write a new report.
export function currentReport(shopId) {
  const { suspended, suspendedAt } = getShopFlags(shopId);
  if (!suspended) return null;
  return (
    read(REPORTS_KEY)
      .filter((r) => r.shopId === shopId && r.suspendedAt === suspendedAt)
      .sort((a, b) => b.at - a.at)[0] || null
  );
}

export function submitSuspensionReport(shopId, { reason, details, plan }) {
  const flags = getShopFlags(shopId);
  if (!flags.suspended) return { ok: false, message: "Your shop is not suspended." };
  if (!REPORT_REASONS.includes(reason)) return { ok: false, message: "Choose what best explains what happened." };
  const d = String(details || "").trim();
  const p = String(plan || "").trim();
  if (d.length < 30) return { ok: false, message: "Please explain what happened in at least 30 characters." };
  if (p.length < 20) return { ok: false, message: "Please tell us how you will prevent it, in at least 20 characters." };
  const report = {
    id: newId("r"),
    shopId,
    suspendedAt: flags.suspendedAt,
    orderIds: flags.suspendOrderIds || [],
    reason,
    details: d.slice(0, 1000),
    plan: p.slice(0, 500),
    at: Date.now(),
    status: "submitted",
    adminNote: "",
  };
  if (!write(REPORTS_KEY, [report, ...read(REPORTS_KEY)].slice(0, 500))) {
    return { ok: false, message: "Your browser blocked saving. Allow site data and try again." };
  }
  return { ok: true, report };
}

// How many suspended shops are waiting for support to read a report.
export function pendingReviewCount() {
  return Object.entries(allShopFlags()).filter(([shopId, f]) => f?.suspended && currentReport(shopId)?.status === "submitted").length;
}

// Support's decision. "more_info" asks the seller to add detail. "reinstate" puts the shop live again.
// Reinstating needs a report, unless support overrides because the suspension was a mistake.
export function reviewSuspension(shopId, action, { note = "", override = false } = {}) {
  const flags = getShopFlags(shopId);
  if (!flags.suspended) return { ok: false, message: "This shop is not suspended." };
  const report = currentReport(shopId);
  if (action === "more_info") {
    if (!report) return { ok: false, message: "The seller has not sent a report yet." };
    if (String(note).trim().length < 5) return { ok: false, message: "Write what you need from the seller." };
    const all = read(REPORTS_KEY).map((r) => (r.id === report.id ? { ...r, status: "more_info", adminNote: String(note).trim().slice(0, 500) } : r));
    write(REPORTS_KEY, all);
    addNotice(shopId, { text: `Support needs more details about your suspension: ${String(note).trim().slice(0, 200)}` });
    return { ok: true };
  }
  if (action === "reinstate") {
    if (!report && !override) return { ok: false, message: "The seller has not written a report yet." };
    if (report) write(REPORTS_KEY, read(REPORTS_KEY).map((r) => (r.id === report.id ? { ...r, status: "accepted", reviewedAt: Date.now() } : r)));
    reinstateShop(shopId);
    addNotice(shopId, { text: "Your shop is live again. Thank you for cooperating. Please keep your promises to buyers.", href: "/my-shop" });
    return { ok: true };
  }
  return { ok: false, message: "Unknown action." };
}
