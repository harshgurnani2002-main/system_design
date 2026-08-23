import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INTERVIEW_QUESTIONS } from "@/content/interview";
import { InterviewTimer, InterviewChecklist } from "../InterviewProgress";

export function generateStaticParams() {
  return INTERVIEW_QUESTIONS.map((q) => ({ slug: q.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const q = INTERVIEW_QUESTIONS.find((x) => x.slug === slug);
  if (!q) return { title: "Interview Problem" };
  return {
    title: `${q.title} (${q.difficulty}) — System Design Interview`,
    description: `${q.summary} — Complete 40-minute system design interview guide with requirements, capacity calculations, architecture, and failure handling.`,
    openGraph: {
      title: `${q.title} | System Design Academy`,
      description: q.summary,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: q.title,
      description: q.summary,
    },
  };
}

export default async function InterviewQuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = INTERVIEW_QUESTIONS.find((x) => x.slug === slug);
  if (!q) notFound();

  const idx = INTERVIEW_QUESTIONS.findIndex((x) => x.slug === slug);
  const next = idx < INTERVIEW_QUESTIONS.length - 1 ? INTERVIEW_QUESTIONS[idx + 1] : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 font-mono text-2xs text-ink-faint">
        <Link href="/academy" className="hover:text-accent">academy</Link>
        <span>/</span>
        <Link href="/academy/interview" className="hover:text-accent">interview</Link>
        <span>/</span>
        <span className="text-accent">{q.slug}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            {q.difficulty} · design problem
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{q.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mute">{q.summary}</p>
        </div>
        <InterviewTimer minutes={q.minutes} />
      </header>

      <div className="space-y-10 py-8">
        {/* requirements */}
        <section>
          <SectionNum n="1" title="Requirements" />
          <div className="grid gap-4 md:grid-cols-2">
            <ReqList title="Functional" tone="accent" items={q.requirements.functional} />
            <ReqList title="Non-functional" tone="warn" items={q.requirements.nonFunctional} />
          </div>
        </section>

        {/* estimation */}
        <section>
          <SectionNum n="2" title="Back-of-envelope estimation" />
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {q.estimation.map((e) => (
              <div key={e.label} className="rounded-lg border border-line bg-surface p-3">
                <dt className="text-2xs font-medium uppercase tracking-wide text-ink-faint">{e.label}</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-medium text-ink">{e.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* architecture notes */}
        <section>
          <SectionNum n="3" title="Architecture — the shape that works" note={<BuilderLink />} />
          <ul className="space-y-2">
            {q.architectureNotes.map((n, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-sm bg-accent/70" />
                {n}
              </li>
            ))}
          </ul>
        </section>

        {/* deep dives */}
        <section>
          <SectionNum n="4" title="Deep dives — where interviews are won" />
          <div className="space-y-3">
            {q.deepDives.map((d) => (
              <article key={d.topic} className="rounded-xl border border-line bg-surface p-4">
                <h3 className="text-sm font-semibold text-accent-ink">{d.topic}</h3>
                <ul className="mt-2 space-y-1">
                  {d.points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-mute">
                      <span className="text-line-strong">—</span> {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* tradeoffs */}
        <section>
          <SectionNum n="5" title="Tradeoffs you must state out loud" />
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-zinc-50/80">
                  <th className="px-4 py-2.5 font-semibold">Dimension</th>
                  <th className="px-4 py-2.5 font-semibold text-accent-ink">{q.tradeoffs[0][1]}</th>
                  <th className="px-4 py-2.5 font-semibold text-accent-ink">{q.tradeoffs[0][2]}</th>
                </tr>
              </thead>
              <tbody>
                {q.tradeoffs.map((row, i) => (
                  <tr key={i} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{row[0]}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{row[1]}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* failure handling */}
        <section>
          <SectionNum n="6" title="Failure handling" />
          <ul className="space-y-2">
            {q.failureHandling.map((f, i) => (
              <li key={i} className="rounded-lg border border-danger-border/60 bg-danger-soft/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-danger-ink">
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* checklist */}
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Interview scorecard — check as you cover each</h2>
          <InterviewChecklist slug={q.slug} items={q.checklist} />
        </section>
      </div>

      {next && (
        <footer className="flex items-center justify-between border-t border-line pt-6">
          <Link href="/academy/interview" className="text-xs text-ink-mute hover:text-ink">← all problems</Link>
          <Link href={`/academy/interview/${next.slug}`} className="text-sm font-medium text-accent hover:text-accent-hover">
            Next: {next.title} →
          </Link>
        </footer>
      )}
    </div>
  );
}

function SectionNum({ n, title, note }: { n: string; title: string; note?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 border-b border-line pb-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink font-mono text-xs font-semibold text-white">{n}</span>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <span className="ml-auto">{note}</span>
    </div>
  );
}

function BuilderLink() {
  return (
    <Link href="/academy/builder" className="font-mono text-2xs text-accent hover:text-accent-hover">
      sketch it in the builder ↗
    </Link>
  );
}

function ReqList({ title, items, tone }: { title: string; items: string[]; tone: "accent" | "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "accent" ? "border-accent-border bg-accent-soft/50" : "border-warn-border bg-warn-soft/50"}`}>
      <h3 className={`font-mono text-2xs uppercase tracking-widest ${tone === "accent" ? "text-accent-ink" : "text-warn-ink"}`}>{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-ink-soft">{it}</li>
        ))}
      </ul>
    </div>
  );
}
