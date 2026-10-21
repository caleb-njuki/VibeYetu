import { STATUS, TONES } from "../lib/orders.js";

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TONES[s.tone]}`}>{s.label}</span>;
}
