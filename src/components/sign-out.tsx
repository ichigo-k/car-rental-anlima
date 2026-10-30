"use client";
import { createAuthClient } from "better-auth/react";
export function SignOut() {
  return (
    <button
      className="text-link"
      onClick={async () => {
        await createAuthClient().signOut();
        window.location.assign("/");
      }}
    >
      Sign out
    </button>
  );
}
