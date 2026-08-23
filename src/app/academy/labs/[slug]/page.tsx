import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LABS } from "@/content/labs";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Callout } from "@/components/ui/Callout";
import { LabCompleteButton } from "../LabProgress";

export function generateStaticParams() {
  return LABS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lab = LABS.find((l) => l.slug === slug);
  return lab ? { title: `Lab ${lab.num}: ${lab.title}` } : { title: "Lab" };
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = LABS.find((l) => l.slug === slug);
  if (!lab) notFound();

  const idx = LABS.findIndex((l) => l.slug === slug);
  const next = idx < LABS.length - 1 ? LABS[idx + 1] : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 font-mono text-2xs text-ink-faint">
        <Link href="/academy" className="hover:text-accent">academy</Link>
        <span>/</span>
        <Link href="/academy/labs" className="hover:text-accent">labs</Link>
        <span>/</span>
        <span className="text-accent">{lab.slug}</span>
      </nav>

      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Lab {String(lab.num).padStart(2, "0")} · {lab.track} · {lab.minutes} min</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{lab.title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">{lab.objective}</p>
      </header>

      <div className="grid gap-3 py-6 sm:grid-cols-[1fr_240px]">
        <figure>
          <ArchCanvas graph={lab.architecture} height={220} mode="static" />
          <figcaption className="mt-1.5 text-center font-mono text-2xs text-ink-faint">Target architecture</figcaption>
        </figure>
        <aside className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Prerequisites</h2>
          <ul className="mt-2 space-y-1">
            {lab.prereqs.map((p) => (
              <li key={p} className="flex gap-2 text-[13px] text-ink-soft">
                <span className="text-accent">▸</span> {p}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* instructions */}
      <section aria-label="Instructions" className="space-y-4">
        <h2 className="border-b border-line pb-2 text-lg font-semibold tracking-tight text-ink">Build it</h2>
        {lab.instructions.map((step, i) => (
          <div key={i} className="flex gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-mono text-xs font-semibold text-accent-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">{step.step}</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-mute">{step.detail}</p>
            </div>
          </div>
        ))}
      </section>

      {/* code */}
      {lab.code && (
        <section className="mt-10 space-y-4" aria-label="Starter code">
          <h2 className="border-b border-line pb-2 text-lg font-semibold tracking-tight text-ink">Key implementation</h2>
          {lab.code.map((c, i) => (
            <CodeBlock key={i} code={c.code} lang={c.lang} title={c.title} />
          ))}
        </section>
      )}

      {/* tasks */}
      <section className="mt-10 rounded-xl border border-line bg-surface p-5" aria-label="Acceptance tasks">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Prove it works</h2>
        <ul className="mt-2 space-y-1.5">
          {lab.tasks.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-soft">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong font-mono text-2xs text-ink-faint">{i + 1}</span>
              {t}
            </li>
          ))}
        </ul>
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-xs font-medium text-accent hover:text-accent-hover">
            Stuck? Show hints
          </summary>
          <ul className="mt-2 space-y-1">
            {lab.hints.map((h, i) => (
              <li key={i} className="rounded-lg border border-accent-border bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">{h}</li>
            ))}
          </ul>
        </details>
      </section>

      {/* solution */}
      <section className="mt-6">
        <Callout kind="ok" title="Reference solution" md={lab.solution} />
      </section>

      {/* production considerations */}
      <section className="mt-6" aria-label="Production considerations">
        <h2 className="mb-3 border-b border-line pb-2 text-lg font-semibold tracking-tight text-ink">Production considerations</h2>
        <ul className="space-y-1.5">
          {lab.production.map((p, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-sm bg-warn" /> {p}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <LabCompleteButton slug={slug} />
        {next && (
          <Link href={`/academy/labs/${next.slug}`} className="text-sm font-medium text-accent hover:text-accent-hover">
            Next: {next.title} →
          </Link>
        )}
      </footer>
    </div>
  );
}
