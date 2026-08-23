"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { QuizQuestion } from "@/lib/types";
import { QuizCard } from "@/components/sims/QuizCard";
import { useProgress } from "@/lib/store/progress";
import { GLOSSARY } from "@/content/glossary";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function ChapterWrapUp({
  trackSlug,
  trackName,
  slug,
  quiz,
  exercise,
  concepts,
  prev,
  next,
}: {
  trackSlug: string;
  trackName: string;
  slug: string;
  quiz: QuizQuestion[];
  exercise: { prompt: string; hints: string[] } | null;
  concepts: string[];
  prev: { title: string; href: string } | null;
  next: { title: string; href: string };
}) {
  const { completedChapters, completeChapter, uncompleteChapter, quizResults, recordQuiz, bookmarks, toggleBookmark, notes, setNote, markVisited } =
    useProgress();

  useEffect(() => {
    markVisited(`ch:${trackSlug}:${slug}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackSlug, slug]);
  const done = !!completedChapters[slug];
  const bookmarked = bookmarks.includes(slug);
  const result = quizResults[slug];
  const [showNotes, setShowNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState(notes[slug] ?? "");
  const [showHints, setShowHints] = useState(false);
  const [notesSavedFlash, setNotesSavedFlash] = useState(false);

  return (
    <div className="space-y-10 border-t border-line pt-8">
      {/* exercise */}
      {exercise && (
        <section aria-label="Exercise" className="rounded-xl border border-accent-border bg-accent-soft/50 p-5">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-accent-ink">Hands-on exercise</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{exercise.prompt}</p>
          <div className="mt-3">
            <button
              onClick={() => setShowHints((s) => !s)}
              className="text-xs font-medium text-accent hover:text-accent-hover"
              aria-expanded={showHints}
            >
              {showHints ? "Hide hints" : `Show hints (${exercise.hints.length})`}
            </button>
            {showHints && (
              <ul className="mt-2 space-y-1.5">
                {exercise.hints.map((h, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-ink-mute">
                    <span className="font-mono text-ink-faint">{i + 1}.</span> {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* concepts */}
      {concepts.length > 0 && (
        <section aria-label="Related concepts">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Concepts in this chapter</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {concepts.map((c) => {
              const term = GLOSSARY.find((g) => g.id === c);
              if (!term) return null;
              return (
                <Link
                  key={c}
                  href={`/academy/glossary?term=${c}`}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
                >
                  {term.term}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* quiz */}
      {quiz.length > 0 && (
        <section aria-label="Chapter quiz">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Check your judgment</h2>
            {result && (
              <span className={cn("font-mono text-xs", result.correct / result.total >= 0.6 ? "text-ok" : "text-warn")}>
                last attempt: {result.correct}/{result.total}
              </span>
            )}
          </div>
          <QuizCard questions={quiz} quizId={slug} onScore={(c, t) => recordQuiz(slug, c, t)} />
        </section>
      )}

      {/* notes */}
      <section aria-label="Your notes">
        <button
          onClick={() => setShowNotes((s) => !s)}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
          aria-expanded={showNotes}
        >
          <span className="text-sm font-medium text-ink">Private notes</span>
          <span className="font-mono text-2xs text-ink-faint">
            {notes[slug] ? `${notes[slug].length} chars` : "empty"} {showNotes ? "▲" : "▼"}
          </span>
        </button>
        {showNotes && (
          <div className="animate-fadeUp mt-2 rounded-xl border border-line bg-surface p-4">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Architecture decisions you want to remember, interview angles, open questions…"
              rows={5}
              className="w-full resize-y rounded-lg border border-line bg-zinc-50 p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:bg-surface focus:outline-none"
              aria-label={`Notes for ${slug}`}
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setNote(slug, noteDraft);
                  setNotesSavedFlash(true);
                  setTimeout(() => setNotesSavedFlash(false), 1500);
                }}
              >
                Save notes
              </Button>
              {notesSavedFlash && <span className="animate-fadeUp font-mono text-2xs text-ok">saved ✓</span>}
            </div>
          </div>
        )}
      </section>

      {/* completion + nav */}
      <footer className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (done ? uncompleteChapter(slug) : completeChapter(slug))}
            aria-pressed={done}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
              done
                ? "border border-ok-border bg-ok-soft text-ok-ink hover:bg-green-100"
                : "bg-accent text-white hover:bg-accent-hover"
            )}
          >
            {done ? "✓ Chapter complete" : "Mark chapter complete"}
          </button>
          <Button size="md" variant="ghost" onClick={() => toggleBookmark(slug)} aria-pressed={bookmarked}>
            {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
          </Button>
        </div>

        <nav aria-label="Chapter navigation" className="flex items-center gap-2">
          {prev && (
            <Link href={prev.href} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-mute transition-colors hover:border-accent hover:text-accent">
              ← {prev.title}
            </Link>
          )}
          <ButtonLink href={next.href} variant={done ? "secondary" : "primary"} size="sm">
            {next.title.includes("Builder") ? "Open the Builder →" : "Next: " + next.title + " →"}
          </ButtonLink>
        </nav>
      </footer>
    </div>
  );
}
