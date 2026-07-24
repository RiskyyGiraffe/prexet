import Link from "next/link";
import type { ReactNode } from "react";

import { PrexetBrand } from "@/components/prexet-logo";

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="h-screen overflow-y-auto bg-white text-zinc-950">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" aria-label="Prexet home"><PrexetBrand /></Link>
          <nav className="flex items-center gap-4 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-black">Privacy</Link>
            <Link href="/terms" className="hover:text-black">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-xs text-zinc-500">Effective {effectiveDate}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <article className="legal-copy mt-10 space-y-8 text-sm leading-7 text-zinc-600">
          {children}
        </article>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
