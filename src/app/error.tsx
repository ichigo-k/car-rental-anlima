"use client";
import { useTransition } from "react";
import Link from "next/link";
import { PageState } from "@/components/page-state";
export default function ErrorPage({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <PageState
      label="PAGE UNAVAILABLE"
      title="Let’s try that again."
      description="This page couldn’t load just now. Give it another try, or head back to explore the cars."
    >
      <button
        className="button"
        onClick={() => startTransition(() => retry())}
        disabled={pending}
      >
        {pending ? "Trying again…" : "Try again"}
        <span aria-hidden="true">↻</span>
      </button>
      <Link className="button secondary" href="/fleet">
        Explore cars
      </Link>
    </PageState>
  );
}
