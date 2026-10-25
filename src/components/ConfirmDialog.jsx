import { useId, useRef } from "react";
import Button from "./Button.jsx";
import useDialog from "../hooks/useDialog.js";

// A small "are you sure?" box. Focus starts on Cancel, so Enter never deletes by accident.
// `children` is the explanation. Put anything extra (like a safer option) inside it.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);
  const titleId = useId();
  useDialog(ref, () => {
    if (!busy) onCancel();
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-card outline-none"
      >
        <h2 id={titleId} className="text-xl font-extrabold">
          {title}
        </h2>
        <div className="space-y-3 text-sm text-ink-soft">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={busy} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
