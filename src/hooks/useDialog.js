import { useEffect, useRef } from "react";

// For a modal dialog. Keeps keyboard focus inside it, closes it on Escape, stops the page
// behind from scrolling, and gives focus back to whatever opened it.
// Put data-autofocus on the element that should get focus first (the safe choice).
export default function useDialog(ref, onEscape) {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        node.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])')
      );
    const first = node.querySelector("[data-autofocus]") || focusable()[0] || node;
    first.focus();

    function onKey(e) {
      if (e.key === "Escape") {
        escape.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === head || !node.contains(document.activeElement))) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (document.activeElement === tail || !node.contains(document.activeElement))) {
        e.preventDefault();
        head.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, [ref]);
}
