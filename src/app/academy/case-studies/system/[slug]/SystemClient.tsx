"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CaseStudy } from "@/lib/caseTypes";
import { DiagramFrame } from "@/components/diagram/DiagramFrame";
import { RequestFlowPlayer } from "@/components/diagram/RequestFlowPlayer";
import { CapacityChain, TradeoffCard, FailureLab } from "@/components/diagram/DiagramExtras";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { useProgress } from "@/lib/store/progress";
import { cn } from "@/lib/utils";

const TABS = [
  "Overview",
  "API & Data",
  "Architecture",
  "Request Flow",
  "Deep Dive",
  "Failure Lab",
  "Scaling",
  "Trade-offs",
  "Interview Mode",
] as const;

type Tab = (typeof TABS)[number];

export function SystemClient({ cs }: { cs: CaseStudy }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const { completeChapter, completedChapters } = useProgress();
  const done = !!completedChapters[`system-${cs.slug}`];
  const idx = TABS.indexOf(tab);

  return (
    <div>
      {/* header */}
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 font-mono text-2xs text-ink-faint">
        <Link href="/academy" className="hover:text-accent">academy</Link>
        <span>/</span>
        <Link href="/academy/case-studies" className="hover:text-accent">real-world systems</Link>
        <span>/</span>
        <span className="text-accent">{cs.slug}</span>
      </nav>

      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{cs.category}</Badge>
          <Badge tone={cs.difficulty === "Expert" ? "danger" : cs.difficulty === "Hard" ? "warn" : cs.difficulty === "Standard" ? "accent" : "ok"}>
            {cs.difficulty}
          </Badge>
          <span className="font-mono text-2xs text-ink-faint">{cs.minutes} min · full design walkthrough</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{cs.name}</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-mute">{cs.tagline}</p>
      </header>

      {/* tab bar */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-paper/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6" role="tablist" aria-label="Case study sections">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t ? "bg-accent-soft text-accent-ink" : "text-ink-mute hover:bg-zinc-100 hover:text-ink"
              )}
            >
              {t}
            </button>
          ))}
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <button
              onClick={() => !done && completeChapter(`system-${cs.slug}`)}
              className={cn(
                "rounded-lg border px-2.5 py-1 font-mono text-2xs transition-colors",
                done ? "border-ok-border bg-ok-soft text-ok-ink" : "border-line text-ink-mute hover:border-ok hover:text-ok"
              )}
            >
              {done ? "✓ studied" : "mark studied"}
            </button>
            <button onClick={() => setTab(TABS[Math.min(TABS.length - 1, idx + 1)])} disabled={idx === TABS.length - 1}
              className="rounded-lg border border-line px-2.5 py-1 font-mono text-2xs text-ink-mute transition-colors hover:border-accent hover:text-accent disabled:opacity-40">
              next →
            </button>
          </div>
        </div>
      </div>

      {/* panels */}
      <div className="space-y-8 py-8">
        {tab === "Overview" && <Overview cs={cs} />}
        {tab === "API & Data" && <ApiData cs={cs} />}
        {tab === "Architecture" && <Architecture cs={cs} />}
        {tab === "Request Flow" && (
          <>
            <SectionIntro title="Slow-motion request walkthrough" sub="Step through the critical path hop by hop — use ▶ for auto-play or the arrows manually." />
            <RequestFlowPlayer graph={cs.architecture} steps={cs.requestFlow} />
          </>
        )}
        {tab === "Deep Dive" && <DeepDives cs={cs} />}
        {tab === "Failure Lab" && (
          <>
            <SectionIntro title="Break it on purpose" sub="Each scenario fails real nodes in the architecture above. Predict the blast radius before reading the answer." />
            <FailureLab graph={cs.architecture} scenarios={cs.failures} />
          </>
        )}
        {tab === "Scaling" && <Scaling cs={cs} />}
        {tab === "Trade-offs" && <Tradeoffs cs={cs} />}
        {tab === "Interview Mode" && <InterviewMode cs={cs} />}
      </div>

      {/* prev/next across systems */}
    </div>
  );
}

/* ---------------- sections ---------------- */

function Overview({ cs }: { cs: CaseStudy }) {
  return (
    <>
      <section className="prose-academy max-w-3xl space-y-4">
        {cs.problem.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReqList title="Functional requirements" tone="accent" items={cs.requirements.functional} />
        <ReqList title="Non-functional requirements" tone="warn" items={cs.requirements.nonFunctional} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <CapacityChain rows={cs.capacity} title={`${cs.name}: users → numbers`} />
        <div className="space-y-3">
          <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Why these numbers matter</h3>
          <p className="text-[13px] leading-relaxed text-ink-mute">
            Every architectural decision in this case study traces back to a row above. Peak QPS sizes the service tier;
            storage growth rules out databases for blobs; read/write ratios decide where caches go. When you can&apos;t
            defend an architecture choice with one of these rows, the choice is fashion — not engineering.
          </p>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h4 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">The interview opener</h4>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{cs.interview.stages[1]?.expect ?? ""}</p>
          </div>
        </div>
      </div>
    </>
  );
}

function ApiData({ cs }: { cs: CaseStudy }) {
  return (
    <>
      <SectionIntro title="API surface" sub="The endpoints that define the product contract — note which carry idempotency keys." />
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-zinc-50/80 font-mono text-2xs uppercase tracking-widest text-ink-faint">
              <th className="px-4 py-2.5">Method</th>
              <th className="px-4 py-2.5">Path</th>
              <th className="px-4 py-2.5">Contract</th>
            </tr>
          </thead>
          <tbody>
            {cs.api.map((e, i) => (
              <tr key={i} className="border-b border-line-soft last:border-0 hover:bg-zinc-50/50">
                <td className="px-4 py-2.5">
                  <MethodBadge method={e.method} />
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-accent-ink">{e.path}</td>
                <td className="px-4 py-2.5 text-ink-mute">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionIntro title="Data model" sub="Entities and the constraints that make them correct under concurrency." />
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-zinc-50/80 font-mono text-2xs uppercase tracking-widest text-ink-faint">
              <th className="px-4 py-2.5">Entity</th>
              <th className="px-4 py-2.5">Key fields</th>
              <th className="px-4 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {cs.dataModel.map((d, i) => (
              <tr key={i} className="border-b border-line-soft last:border-0 hover:bg-zinc-50/50">
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-ink">{d.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-accent-ink">{d.fields}</td>
                <td className="px-4 py-2.5 text-ink-mute">{d.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Architecture({ cs }: { cs: CaseStudy }) {
  return (
    <>
      <SectionIntro title="High-level architecture" sub="Hover any component for its purpose and latency budget; click for the full 'why'. Drag to pan, scroll/pinch to zoom." />
      <DiagramFrame graph={cs.architecture} height={420} title={`${cs.name} — production topology`} />
      <ul className="max-w-3xl space-y-2">
        {cs.archNotes.map((note, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-sm bg-accent/70" />
            {note}
          </li>
        ))}
      </ul>
    </>
  );
}

function DeepDives({ cs }: { cs: CaseStudy }) {
  return (
    <>
      <SectionIntro title="Deep dives" sub="Where interviews are won: the reasoning behind each load-bearing decision." />
      <div className="grid gap-4 lg:grid-cols-2">
        {cs.deepDives.map((d) => (
          <article key={d.topic} className="rounded-xl border border-line bg-surface p-5">
            <h3 className="text-[15px] font-semibold text-accent-ink">{d.topic}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{d.body}</p>
            <ul className="mt-3 space-y-1.5">
              {d.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-mute">
                  <span className="text-line-strong">—</span> {b}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}

function Scaling({ cs }: { cs: CaseStudy }) {
  return (
    <>
      <SectionIntro title="Scaling ladder" sub="Each rung exists because the previous one failed under real load — never scale ahead of evidence." />
      <ol className="space-y-0">
        {cs.scaling.map((s, i) => (
          <li key={s.stage}>
            <div className="animate-fadeUp grid grid-cols-[64px_1fr] gap-4 rounded-lg px-2 py-3" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="w-16 shrink-0 text-right font-mono text-2xs uppercase leading-snug tracking-wide text-ink-faint">{s.stage}</span>
              <span>
                <span className="block text-sm font-medium text-ink">{s.action}</span>
                <span className="block text-[13px] text-ink-mute">{s.why}</span>
              </span>
            </div>
            {i < cs.scaling.length - 1 && <div className="ml-8 h-3 w-px bg-line-strong" aria-hidden />}
          </li>
        ))}
      </ol>

      <SectionIntro title="Production notes & cost reality" sub="What changes when real money and real incidents arrive." />
      <div className="grid gap-4 md:grid-cols-2">
        <ChecklistCard title="Production considerations" tone="accent" items={cs.production} />
        <ChecklistCard title="Cost considerations" tone="warn" items={cs.costs} />
      </div>
    </>
  );
}

function Tradeoffs({ cs }: { cs: CaseStudy }) {
  return (
    <>
      <SectionIntro title="Trade-offs made explicit" sub="There are no correct architectures — only defensible positions on these tables." />
      <div className="space-y-4">
        {cs.tradeoffs.map((t, i) => (
          <TradeoffCard key={i} data={t} />
        ))}
      </div>
      <div className="rounded-xl border border-line bg-surface p-5">
        <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Alternative architectures worth knowing</h3>
        <ul className="mt-2 space-y-1.5">
          {cs.alternatives.map((a, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
              <span className="text-accent">▸</span> {a}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function InterviewMode({ cs }: { cs: CaseStudy }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [covered, setCovered] = useState<Set<number>>(new Set());

  const allCovered = covered.size === cs.interview.stages.length;

  return (
    <>
      <SectionIntro title="Interview mode" sub={`“${cs.interview.prompt}” — reveal guidance stage by stage only AFTER attempting each yourself.`} />

      <CodeBlock
        lang="text"
        title="Suggested time split"
        code={cs.interview.stages
          .map((s, i) => `${String(i + 1).padStart(2)}. ${s.name.padEnd(18)} ${Math.round(cs.minutes / cs.interview.stages.length)} min`)
          .join("\n")}
      />

      <ol className="space-y-2">
        {cs.interview.stages.map((st, i) => {
          const open = revealed.has(i);
          return (
            <li key={st.name} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => setRevealed((r) => new Set(r).add(i))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={open}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold", open ? "bg-accent text-white" : "bg-zinc-100 text-ink-faint")}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-ink">{st.name}</span>
                </button>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 font-mono text-2xs text-ink-faint">
                  <input
                    type="checkbox"
                    checked={covered.has(i)}
                    onChange={() =>
                      setCovered((c) => {
                        const n = new Set(c);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className="accent-blue-600"
                    aria-label={`Mark ${st.name} as covered`}
                  />
                  covered
                </label>
              </div>
              {open && (
                <p className="animate-fadeUp border-t border-line-soft bg-zinc-50/60 px-4 py-3 pl-[60px] text-[13px] leading-relaxed text-ink-soft">
                  {st.expect}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {allCovered && (
        <div className="animate-fadeUp rounded-xl border border-ok-border bg-ok-soft p-4 text-sm text-ok-ink">
          Full arc covered — you just ran a complete {cs.name} design interview. Sketch your version in the{" "}
          <Link href="/academy/builder" className="font-semibold underline underline-offset-2">Architecture Builder</Link>{" "}
          and compare it against this reference.
        </div>
      )}
    </>
  );
}

/* ---------------- atoms ---------------- */

function SectionIntro({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-1">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-ink-mute">{sub}</p>}
    </div>
  );
}

function ReqList({ title, items, tone }: { title: string; items: string[]; tone: "accent" | "warn" }) {
  return (
    <div className={cn("rounded-xl border p-4", tone === "accent" ? "border-accent-border bg-accent-soft/40" : "border-warn-border bg-warn-soft/40")}>
      <h3 className={cn("font-mono text-2xs uppercase tracking-widest", tone === "accent" ? "text-accent-ink" : "text-warn-ink")}>{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className={tone === "accent" ? "text-accent" : "text-warn"}>▸</span> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistCard({ title, items, tone }: { title: string; items: string[]; tone: "accent" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className={cn("font-mono text-2xs uppercase tracking-widest", tone === "accent" ? "text-accent" : "text-warn")}>{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((p, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-sm" style={{ background: tone === "accent" ? "#2563EB" : "#D97706" }} /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const tones: Record<string, string> = {
    GET: "border-ok-border bg-ok-soft text-ok-ink",
    POST: "border-accent-border bg-accent-soft text-accent-ink",
    PUT: "border-warn-border bg-warn-soft text-warn-ink",
    DELETE: "border-danger-border bg-danger-soft text-danger-ink",
  };
  return (
    <span className={cn("inline-block rounded-md border px-1.5 py-0.5 font-mono text-2xs", tones[method.split(" ")[0]] ?? "border-line bg-zinc-100 text-ink-mute")}>
      {method}
    </span>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "neutral" | "accent" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "border-line bg-zinc-100 text-ink-soft",
    accent: "border-accent-border bg-accent-soft text-accent-ink",
    ok: "border-ok-border bg-ok-soft text-ok-ink",
    warn: "border-warn-border bg-warn-soft text-warn-ink",
    danger: "border-danger-border bg-danger-soft text-danger-ink",
  };
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-2xs", tones[tone])}>{children}</span>;
}
