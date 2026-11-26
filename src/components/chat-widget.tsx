"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircleDots, PaperPlaneRight, X } from "@phosphor-icons/react";

type Turn = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = [
  "Which SUVs do you have?",
  "Is the Toyota Camry free next weekend?",
  "What do I need to bring at pickup?",
  "How do cancellations work?",
];
// Site paths in a reply become links; everything else stays plain text.
const PATH =
  /(\/(?:fleet(?:\/[a-z0-9-]+)?|bookings|contact|how-it-works|policies|sign-in)\b)/g;
function Rich({ text }: { text: string }) {
  return text
    .replaceAll("**", "")
    .split("\n")
    .map((row, i) => (
      <Fragment key={i}>
        {i > 0 && <br />}
        {row.split(PATH).map((part, j) =>
          j % 2 ? (
            <Link key={j} href={part}>
              {part}
            </Link>
          ) : (
            part
          ),
        )}
      </Fragment>
    ));
}

export function ChatWidget({ enabled }: { enabled: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns, open]);
  useEffect(() => () => abort.current?.abort(), []);
  if (
    !enabled ||
    path.startsWith("/admin") ||
    path.startsWith("/staff-security")
  )
    return null;

  async function ask(question: string) {
    const text = question.trim().slice(0, 1000);
    if (!text || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: text }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the latest 20 turns are sent; the server keeps nothing.
        body: JSON.stringify({ messages: history.slice(-19) }),
        signal: abort.current.signal,
      });
      if (!res.body) throw new Error("No response.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw) continue;
          const event = JSON.parse(raw) as { t: string; v?: string };
          if (event.t === "text") {
            answer += event.v;
            setTurns([...history, { role: "assistant", content: answer }]);
          } else if (event.t === "error") setError(event.v ?? "");
        }
      }
      // A turn with no answer is dropped so the history stays valid.
      if (!answer.trim()) setTurns(history.slice(0, -1));
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("The assistant could not be reached. Please try again.");
      setTurns(history.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" aria-label="ANLIMA assistant">
          <header>
            <div>
              <strong>ANLIMA assistant</strong>
              <small>
                AI · may make mistakes · check prices on the car page
              </small>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="chat-log" ref={log} aria-live="polite">
            {!turns.length && (
              <div className="chat-welcome">
                <p>
                  Hello! I can help you find a car, check availability and
                  prices, and explain how booking works.
                </p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => void ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`chat-turn chat-turn--${t.role}`}>
                {t.content ? (
                  <Rich text={t.content} />
                ) : (
                  <span
                    className="chat-typing"
                    aria-label="Assistant is typing"
                  >
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>
            ))}
            {error && (
              <p className="chat-error" role="alert">
                <Rich text={error} />
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <label className="visually-hidden" htmlFor="chat-input">
              Your question
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about cars, prices or booking…"
              maxLength={1000}
              autoComplete="off"
              disabled={busy}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={busy || !draft.trim()}
            >
              <PaperPlaneRight size={18} weight="fill" />
            </button>
          </form>
          <p className="chat-privacy">
            Please don’t share card, Ghana Card or licence numbers here.
          </p>
        </section>
      )}
      <button
        type="button"
        className="chat-launcher"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <ChatCircleDots size={24} weight="fill" />}
        <span>{open ? "Close" : "Ask ANLIMA"}</span>
      </button>
    </div>
  );
}
