"use client";

import { useState } from "react";
import Link from "next/link";
import { CHAPTERS, TRACKS, trackChapters, chapterHref } from "@/content";
import { useProgress } from "@/lib/store/progress";
import { Tabs } from "@/components/ui/Controls";
import { SKILL_LABELS, computeSkills } from "@/lib/skills";
import { cn } from "@/lib/utils";

type Tab = "progress" | "skills" | "bookmarks" | "notes";

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>("progress");
  const progress = useProgress();
  const skills = computeSkills(CHAPTERS, progress.completedChapters);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-7">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">You</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Progress &amp; Skills</h1>
        </div>
        <Tabs
          tabs={[
            { id: "progress", label: "Learning" },
            { id: "skills", label: "Skill map" },
            { id: "bookmarks", label: "Bookmarks", count: progress.bookmarks.length },
            { id: "notes", label: "Notes", count: Object.keys(progress.notes).length },
          ]}
          active={tab}
          onChange={(t) => setTab(t as Tab)}
        />
      </header>

      <div className="py-8">
        {tab === "progress" && <LearningTab />}
        {tab === "skills" && <SkillMap skills={skills} />}
        {tab === "bookmarks" && <BookmarksTab slugs={progress.bookmarks} onRemove={progress.toggleBookmark} />}
        {tab === "notes" && <NotesTab notes={progress.notes} />}
      </div>
    </div>
  );
}

function LearningTab() {
  const completed = useProgress((s) => s.completedChapters);
  const quizzes = useProgress((s) => s.quizResults);
  const labs = useProgress((s) => s.completedLabs);

  const totalMin = CHAPTERS.reduce((a, c) => a + c.minutes, 0);
  const doneChapters = CHAPTERS.filter((c) => completed[c.slug]);
  const doneMin = doneChapters.reduce((a, c) => a + c.minutes, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Reading time invested" value={`${Math.round(doneMin / 60)}h ${doneMin % 60}m`} sub={`of ${Math.round(totalMin / 60)}h available`} />
        <Stat label="Chapters" value={`${doneChapters.length}/${CHAPTERS.length}`} />
        <Stat
          label="Quiz accuracy"
          value={
            Object.keys(quizzes).length
              ? `${Math.round(
                  (Object.values(quizzes).reduce((a, r) => a + r.correct, 0) /
                    Object.values(quizzes).reduce((a, r) => a + r.total, 0)) *
                    100
                )}%`
              : "—"
          }
        />
        <Stat label="Labs shipped" value={`${Object.keys(labs).length}/13`} />
      </div>

      {TRACKS.map((t) => {
        const chapters = trackChapters(t.slug);
        if (chapters.length === 0) return null;
        return (
          <section key={t.slug}>
            <h2 className="mb-2 font-mono text-2xs uppercase tracking-widest text-ink-faint">{t.name}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {chapters.map((c) => {
                const done = !!completed[c.slug];
                const q = quizzes[c.slug];
                return (
                  <li key={c.slug}>
                    <Link href={chapterHref(c)} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-2xs",
                          done ? "border-ok-border bg-ok-soft text-ok-ink" : "border-line-strong text-transparent"
                        )}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.title}</span>
                      {q && (
                        <span className={cn("shrink-0 font-mono text-2xs", q.correct / q.total >= 0.75 ? "text-ok" : "text-warn")}>
                          quiz {q.correct}/{q.total}
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-2xs text-ink-faint">{c.minutes}m</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SkillMap({ skills }: { skills: Record<string, { done: number; total: number }> }) {
  return (
    <div id="skills" className="grid max-w-2xl gap-5 md:grid-cols-2 md:gap-x-10">
      {Object.entries(SKILL_LABELS).map(([id, label]) => {
        const s = skills[id] ?? { done: 0, total: 0 };
        const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
        return (
          <div key={id}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-medium text-ink">{label}</span>
              <span className="tabular font-mono text-xs text-ink-faint">{s.total ? `${pct}%` : "—"}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
              <div className={cn("transition-all duration-500", pct === 100 ? "bg-ok" : "bg-accent")} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-2xs leading-snug text-ink-faint">
              {s.total === 0
                ? "No chapters tagged yet"
                : `${s.done} of ${s.total} contributing chapters complete`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function BookmarksTab({ slugs, onRemove }: { slugs: string[]; onRemove: (slug: string) => void }) {
  if (slugs.length === 0)
    return <Empty text="No bookmarks yet. Use ☆ Bookmark on any chapter to build your review queue." />;
  return (
    <ul className="max-w-3xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {slugs.map((slug) => {
        const ch = CHAPTERS.find((c) => c.slug === slug);
        return (
          <li key={slug} className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href={ch ? chapterHref(ch) : "#"} className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent">
              {ch?.title ?? slug}
            </Link>
            <button onClick={() => onRemove(slug)} aria-label={`Remove bookmark ${ch?.title ?? slug}`} className="rounded p-1 font-mono text-xs text-ink-faint hover:text-danger">
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NotesTab({ notes }: { notes: Record<string, string> }) {
  const entries = Object.entries(notes).filter(([, v]) => v.trim());
  if (entries.length === 0)
    return <Empty text="No notes yet. Every chapter has a private notes panel at the bottom — capture decisions and open questions there." />;
  return (
    <div className="space-y-3">
      {entries.map(([slug, text]) => {
        const ch = CHAPTERS.find((c) => c.slug === slug);
        return (
          <article key={slug} className="rounded-xl border border-line bg-surface p-4">
            <Link href={ch ? chapterHref(ch) : "#"} className="font-mono text-2xs uppercase tracking-widest text-accent hover:text-accent-hover">
              {ch?.title ?? slug}
            </Link>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{text}</p>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="tabular font-mono text-xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-ink-soft">{label}</div>
      {sub && <div className="text-2xs text-ink-faint">{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong p-10 text-center text-sm text-ink-mute">
      {text}
    </div>
  );
}
