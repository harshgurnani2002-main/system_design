import type { Metadata } from "next";
import Link from "next/link";
import { SYSTEMS, CATEGORIES, RECOMMENDED_ORDER } from "@/content/systems";

export const metadata: Metadata = {
  title: "Real-World Systems",
  description: "Twenty complete system design case studies — requirements, capacity math, architecture, request flows, failure labs and interview mode.",
};

const DIFF_STYLE: Record<string, string> = {
  "Warm-up": "border-ok-border bg-ok-soft text-ok-ink",
  Standard: "border-accent-border bg-accent-soft text-accent-ink",
  Hard: "border-warn-border bg-warn-soft text-warn-ink",
  Expert: "border-danger-border bg-danger-soft text-danger-ink",
};

export default function CaseStudiesIndex() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Case studies · real-world systems</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink md:text-4xl">Twenty Systems, Fully Designed</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Each case study is a complete design exercise: problem → requirements → capacity math → API & data model →
          interactive architecture with live traffic → slow-motion request flow → failure lab → scaling ladder →
          trade-offs → interview mode. Not summaries — reconstructions.
        </p>
      </header>

      {/* recommended order strip */}
      <section className="mt-8">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Suggested learning path</h2>
        <ol className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {RECOMMENDED_ORDER.map((cs, i) => (
            <li key={cs.slug} className="shrink-0">
              <Link
                href={`/academy/case-studies/system/${cs.slug}`}
                className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 transition-colors hover:border-accent"
              >
                <span className="font-mono text-2xs text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xs font-medium text-ink group-hover:text-accent">{cs.name}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* category grids */}
      {CATEGORIES.map((cat) => (
        <section key={cat} className="mt-10">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">{cat}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEMS.filter((s) => s.category === cat).map((cs) => (
              <Link
                key={cs.slug}
                href={`/academy/case-studies/system/${cs.slug}`}
                className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent-border hover:bg-accent-soft/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-ink group-hover:text-accent-ink">{cs.name}</h3>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-2xs ${DIFF_STYLE[cs.difficulty]}`}>
                    {cs.difficulty}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-ink-mute">{cs.tagline}</p>
                <p className="mt-3 font-mono text-2xs text-ink-faint">{cs.minutes} min · {cs.failures.length} failure sims</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* legacy deep dives */}
      <section className="mt-12 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Companion deep dives</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Link href="/academy/case-studies/instagram" className="group rounded-lg border border-line px-4 py-3 transition-colors hover:border-accent">
            <span className="text-sm font-medium text-ink group-hover:text-accent-ink">Instagram: architecture evolution V1→V10</span>
            <span className="block text-xs text-ink-mute">Ten stages, each forced by a real bottleneck — the evolution player.</span>
          </Link>
          <Link href="/academy/case-studies/zomato" className="group rounded-lg border border-line px-4 py-3 transition-colors hover:border-accent">
            <span className="text-sm font-medium text-ink group-hover:text-accent-ink">Zomato: order lifecycle forensics</span>
            <span className="block text-xs text-ink-mute">Interactive saga state machine plus five production incident dissections.</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
