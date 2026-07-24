"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PrexetMark } from "@/components/prexet-logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function PrexetLanding() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (result.error) {
      setError(result.error.message || "Google sign-in could not be started.");
      setBusy(false);
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-zinc-50 px-5 py-10 text-zinc-950">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-between gap-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold" aria-label="Prexet home">
            <span className="grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white text-black">
              <PrexetMark className="size-6" />
            </span>
            Prexet
          </Link>
          <nav className="flex gap-4 text-xs text-zinc-500" aria-label="Legal">
            <Link href="/privacy" className="hover:text-black">Privacy</Link>
            <Link href="/terms" className="hover:text-black">Terms</Link>
          </nav>
        </header>

        <div className="grid items-center gap-12 md:grid-cols-[1fr_380px]">
          <section>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Document workflows</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Prexet is a document outreach and redlining workspace.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-600">
              Prexet helps professional teams upload forms and recipient lists, organize recipients into project stages, prepare native Word redlines with AI, review individual transmission drafts, and send approved emails through a connected Gmail account.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-600">
              Gmail sending access is used only for emails the user reviews and approves. Users may separately opt into read-only inbox search; it is off by default, never permits deletion or mailbox changes, and can be turned off in account settings.
            </p>
          </section>

          <section className="w-full rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm" aria-labelledby="sign-in-heading">
            <h2 id="sign-in-heading" className="text-xl font-semibold tracking-tight">Sign in to Prexet</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Access your document workflow workspace.</p>
            <Button className="mt-7 w-full" size="lg" onClick={() => void signInWithGoogle()} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <span className="text-base font-bold">G</span>}
              Continue with Google
            </Button>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <p className="mt-5 text-xs leading-5 text-zinc-500">
              By continuing, you agree to the <Link href="/terms" className="underline underline-offset-2 hover:text-black">Terms</Link> and acknowledge the <Link href="/privacy" className="underline underline-offset-2 hover:text-black">Privacy Policy</Link>.
            </p>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>© {new Date().getFullYear()} Prexet</span>
          <span>Document outreach, redlining, and approved email sending.</span>
        </footer>
      </div>
    </main>
  );
}
