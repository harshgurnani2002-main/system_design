"use client";

import Link from "next/link";
import { TRACKS, trackChapters, CHAPTERS } from "@/content";
import { chapterHref } from "@/content";
import { useProgress } from "@/lib/store/progress";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SKILLS, SKILL_LABELS, computeSkills } from "@/lib/skills";

export default function Dashboard() {
  const progress = useProgress();
  const completed = progress.completedChapters;
  const doneCount = Object.keys(completed).length;
  const skills = computeSkills(CHAPTERS, completed);

  // last visited chapter (from visited map), else first incomplete
  const visitedSlugs = Object.entries(progress.visited)
    .filter(([k]) => k.startsWith("ch:"))
    .sort((a, b) => b[1] - a[1]);
  let continueTarget = null as null | { title: string; href: string; sub: string };
  for (const [key] of visitedSlugs) {
    const [, trackSlug, chSlug] = key.split(":");
    const ch = CHAPTERS.find((c) => c.track === trackSlug && c.slug === chSlug);
    if (ch && !completed[ch.slug]) {
      continueTarget = {
        title: ch.title,
        href: chapterHref(ch),
        sub: `${ch.track.replace("-", " ")} · ${ch.minutes} min`,
      };
      break;
    }
  }
  if (!continueTarget) {
    const next = CHAPTERS.find((c) => !completed[c.slug]) ?? CHAPTERS[0];
    continueTarget = {
      title: next.title,
      href: chapterHref(next),
      sub: `${next.track.replace("-", " ")} · ${next.minutes} min`,
    };
  }

  const quizAvg = (() => {
    const rs = Object.values(progress.quizResults);
    if (rs.length === 0) return null;
    const c = rs.reduce((a, r) => a + r.correct, 0);
    const t = rs.reduce((a, r) => a + r.total, 0);
    return Math.round((c / t) * 100);
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Engineering Dashboard</h1>
          <p className="mt-1 text-sm text-ink-mute">
            Your system design practice — grounded in numbers, not streaks.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/academy/builder" variant="secondary" size="sm">Architecture Builder</ButtonLink>
          <ButtonLink href="/academy/simulator" variant="secondary" size="sm">Simulator</ButtonLink>
        </div>
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Chapters completed" value={`${doneCount}/${CHAPTERS.length}`} href="/academy/progress" />
        <StatCard label="Quiz accuracy" value={quizAvg !== null ? `${quizAvg}%` : "—"} sub={quizAvg === null ? "take your first quiz" : `${Object.keys(progress.quizResults).length} quizzes taken`} href="/academy/quizzes" />
        <StatCard label="Labs shipped" value={`${Object.keys(progress.completedLabs).length}/13`} href="/academy/labs" />
        <StatCard label="Interview drills" value={`${Object.keys(progress.interviewDone).length}/8`} href="/academy/interview" />
      </div>

      {/* continue + skills */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[7fr_5fr]">
        <section aria-label="Continue learning" className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Continue</h2>
          <Link href={continueTarget.href} className="group mt-3 block">
            <div className="text-lg font-semibold text-ink group-hover:text-accent">{continueTarget.title}</div>
            <div className="mt-0.5 text-xs capitalize text-ink-mute">{continueTarget.sub}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
              Resume
              <svg viewBox="0 0 12 12" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </Link>
          <div className="mt-5 border-t border-line-soft pt-4">
            <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Signature lesson</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              <strong>How does Instagram handle 1 million likes?</strong> Push traffic into a live architecture until it
              breaks, then fix it with caching, async batching and sharded counters.
            </p>
            <ButtonLink href="/academy/learn/core-design/caching" variant="subtle" size="sm" className="mt-3">
              Run the simulation
            </ButtonLink>
          </div>
        </section>

        <section aria-label="Skill map" className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Skill map</h2>
            <Link href="/academy/progress#skills" className="text-xs text-accent hover:text-accent-hover">details →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {(Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[])
              .map((sk) => ({ sk, s: skills[sk] ?? { done: 0, total: 0 } }))
              .filter(({ s }) => s.total > 0)
              .sort((a, b) => b.s.done / b.s.total - a.s.done / a.s.total)
              .slice(0, 6)
              .map(({ sk, s }) => (
                <SkillBar key={sk} label={SKILL_LABELS[sk]} done={s.done} total={s.total} />
              ))}
          </div>
        </section>
      </div>

      {/* tracks */}
      <section aria-label="Curriculum" className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Curriculum</h2>
          <span className="font-mono text-2xs text-ink-faint">{TRACKS.length} tracks · {CHAPTERS.length} chapters</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {TRACKS.map((t) => {
            const chapters = trackChapters(t.slug);
            const done = chapters.filter((c) => completed[c.slug]).length;
            return (
              <Link
                key={t.slug}
                href={`/academy/learn/${t.slug}`}
                className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="neutral">{t.level}</Badge>
                    <h3 className="mt-2 font-medium text-ink group-hover:text-accent-ink">{t.name}</h3>
                  </div>
                  <span className="font-mono text-2xs text-ink-mute">
                    {done}/{chapters.length}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">{t.blurb}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn("h-full rounded-full transition-all", done === chapters.length && chapters.length > 0 ? "bg-ok" : "bg-accent")}
                    style={{ width: `${chapters.length ? (done / chapters.length) * 100 : 0}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* tools row */}
      <section aria-label="Tools" className="mt-10 grid gap-3 md:grid-cols-3">
        <ToolCard
          href="/academy/case-studies"
          title="Case Studies"
          desc="Watch Instagram evolve from one server to a multi-region platform across ten versions."
        />
        <ToolCard
          href="/academy/failures"
          title="Break The System"
          desc="Diagnose production incidents from symptoms, logs, metrics and traces."
        />
        <ToolCard
          href="/academy/glossary"
          title="Glossary"
          desc="CAP, quorum, saga, outbox — precise definitions with real-world examples."
        />
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, href }: { label: string; value: string; sub?: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent-border">
      <div className="font-mono text-xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-ink-soft">{label}</div>
      {sub && <div className="text-2xs text-ink-faint">{sub}</div>}
    </Link>
  );
}

function SkillBar({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className="tabular font-mono text-2xs text-ink-faint">
          {done}/{total}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ToolCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent-border">
      <h3 className="font-medium text-ink group-hover:text-accent-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{desc}</p>
    </Link>
  );
}
