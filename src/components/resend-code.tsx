"use client";
import { useEffect, useState } from "react";
// Texts a fresh code to the same number. A short wait between sends keeps
// SMS costs down and stops repeated taps.
const WAIT_SECONDS = 30;
export function ResendCode({
  send,
  disabled,
}: {
  send: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const [wait, setWait] = useState(WAIT_SECONDS);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  return (
    <p className="resend-code">
      {sent && wait > 0 && <span role="status">New code sent. </span>}
      <button
        type="button"
        className="text-link"
        disabled={disabled || wait > 0}
        onClick={async () => {
          if (await send()) {
            setSent(true);
            setWait(WAIT_SECONDS);
          }
        }}
      >
        {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
      </button>
    </p>
  );
}
