import { useState } from "react";
import Button from "./Button.jsx";
import { formatWhen } from "../lib/orders.js";

const REASONS = {
  buyer: [
    "I did not receive the item",
    "The item arrived late",
    "The item was faulty or wrong",
    "The seller could not be reached",
    "Other",
  ],
  seller: [
    "The buyer could not be reached",
    "The buyer was not at the location",
    "I could not deliver in time",
    "The item was refused or returned",
    "Other",
  ],
};

// The short form both sides answer when the 24-hour window ends.
export default function ReviewForm({ role, report, onSubmit }) {
  const [reason, setReason] = useState(REASONS[role][0]);
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  if (report) {
    return (
      <div className="space-y-1 rounded-xl bg-ivory p-4 text-sm">
        <p className="font-bold">Your answers were sent on {formatWhen(report.at)}</p>
        <p>{report.reason}</p>
        <p className="text-ink-soft">{report.details}</p>
      </div>
    );
  }

  function submit(e) {
    e.preventDefault();
    if (details.trim().length < 10) {
      setError("Please tell us what happened in a few words.");
      return;
    }
    const result = onSubmit({ reason, details: details.trim() });
    setError(result && !result.ok ? result.message : "");
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <label htmlFor={`${role}-reason`} className="text-sm font-semibold">
          What happened?
        </label>
        <select
          id={`${role}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm"
        >
          {REASONS[role].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${role}-details`} className="text-sm font-semibold">
          Tell us more
        </label>
        <textarea
          id={`${role}-details`}
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="w-full rounded-xl border border-ink/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <Button type="submit">Send answers</Button>
    </form>
  );
}
