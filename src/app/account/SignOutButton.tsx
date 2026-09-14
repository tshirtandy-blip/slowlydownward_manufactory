"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/account" })} className="label-caps text-stone hover:text-accent">
      Sign out
    </button>
  );
}
