import type { Metadata } from "next";
import { Suspense } from "react";
import { GlossaryClient } from "./GlossaryClient";

export const metadata: Metadata = {
  title: "Glossary",
  description: "Precise engineering definitions: CAP, quorum, saga, outbox, idempotency and more.",
};

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Reference</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Glossary</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Every term comes with a plain-language version, the precise technical definition, a real-world example, and
          its connections — because concepts only make sense as a graph.
        </p>
      </header>
      <Suspense fallback={<div className="text-sm text-ink-mute">Loading glossary…</div>}>
        <GlossaryClient />
      </Suspense>
    </div>
  );
}
