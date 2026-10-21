import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { getReply } from "../services/helpBot.js";

const COPY = {
  en: {
    title: "VibeYetu Help",
    sub: "Ask me about buying safely",
    welcome: "Hi, karibu! I'm your VibeYetu helper. Ask me how escrow works, how to check a shop, or how to get a refund.",
    placeholder: "Type your question",
    typing: "Typing...",
    close: "Close help",
    suggestions: ["How do I check if a shop is legit?", "How do I get a refund?", "How does escrow work?"],
  },
  sw: {
    title: "Msaada wa VibeYetu",
    sub: "Niulize kuhusu kununua kwa usalama",
    welcome: "Karibu! Mimi ni msaidizi wako wa VibeYetu. Niulize escrow inavyofanya kazi, jinsi ya kukagua duka, au kurudishiwa pesa.",
    placeholder: "Andika swali lako",
    typing: "Anaandika...",
    close: "Funga msaada",
    suggestions: ["Nitajuaje duka ni halali?", "Nitarudishiwaje pesa zangu?", "Escrow inafanyaje kazi?"],
  },
};

export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const idRef = useRef(0);
  const t = COPY[lang];

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    idRef.current += 1;
    const userMsg = { id: idRef.current, role: "user", text: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    const reply = await getReply(q, lang);
    idRef.current += 1;
    setMessages((m) => [...m, { id: idRef.current, role: "bot", text: reply }]);
    setBusy(false);
  }

  function onSubmit(e) {
    e.preventDefault();
    send(input);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open VibeYetu help"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-vibe px-4 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-vibe-dark"
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Help</span>
      </button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.title} className="fixed inset-0 z-[60] flex flex-col bg-ivory">
      <div className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vibe text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold leading-tight">{t.title}</h2>
            <p className="truncate text-xs text-ink-mute">{t.sub}</p>
          </div>
          <div className="flex rounded-full bg-ink/5 p-1 text-xs font-bold" role="group" aria-label="Language">
            {[["en", "EN"], ["sw", "SW"]].map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`rounded-full px-3 py-1 ${lang === code ? "bg-ink text-white" : "text-ink-soft"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.close}
            className="rounded-full p-2 hover:bg-ink/5"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm shadow-card">{t.welcome}</div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {t.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-vibe/30 bg-vibe-light px-4 py-2 text-left text-sm font-medium text-vibe-dark hover:bg-vibe/20"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user" ? "rounded-tr-sm bg-vibe text-white" : "rounded-tl-sm bg-white shadow-card"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {busy && <p className="text-xs text-ink-mute">{t.typing}</p>}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            className="flex-1 rounded-full bg-ivory px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-vibe text-white hover:bg-vibe-dark disabled:opacity-50"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
