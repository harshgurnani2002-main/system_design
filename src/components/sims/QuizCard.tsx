"use client";

import { useMemo, useState } from "react";
import type { QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function QuizCard({
  questions,
  quizId,
  onScore,
}: {
  questions: QuizQuestion[];
  quizId: string;
  onScore?: (correct: number, total: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  const q = questions[idx];
  const correctSet = useMemo(() => new Set(q?.correct ?? []), [q]);
  const isCorrect =
    answered &&
    selected.length === q.correct.length &&
    selected.every((s) => correctSet.has(s));

  function toggle(i: number) {
    if (answered) return;
    if (q.multi) {
      setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    } else {
      setSelected([i]);
    }
  }

  function submit() {
    if (selected.length === 0) return;
    setAnswered(true);
    const ok =
      selected.length === q.correct.length && selected.every((s) => correctSet.has(s));
    setResults((r) => [...r, ok]);
  }

  function next() {
    if (idx + 1 >= questions.length) {
      setDone(true);
      const finalResults = [...results];
      const score = finalResults.filter(Boolean).length;
      onScore?.(score, questions.length);
    } else {
      setIdx((i) => i + 1);
      setSelected([]);
      setAnswered(false);
    }
  }

  function restart() {
    setIdx(0);
    setSelected([]);
    setAnswered(false);
    setResults([]);
    setDone(false);
  }

  if (done) {
    const score = results.filter(Boolean).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <div className="font-mono text-3xl font-bold text-ink">{pct}%</div>
        <p className="mt-1 text-sm text-ink-mute">
          {score} of {questions.length} correct
        </p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
          {pct === 100
            ? "Perfect. You didn't just memorize — you reasoned."
            : pct >= 60
              ? "Solid. Revisit the explanations you missed — they contain the real lesson."
              : "Worth re-reading this chapter's failure scenarios before retrying."}
        </p>
        <Button className="mt-4" size="sm" onClick={restart}>
          Retake quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" data-quiz={quizId}>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-xs text-ink-faint">
          Question {idx + 1} / {questions.length}
          {q.multi && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-2xs">multi-select</span>}
        </span>
        <span className="font-mono text-xs text-accent">{q.id}</span>
      </div>
      <div className="p-5">
        <p className="text-[15px] font-medium leading-relaxed text-ink">{q.q}</p>
        <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Answer options">
          {q.options.map((opt, i) => {
            const sel = selected.includes(i);
            const revealCorrect = answered && correctSet.has(i);
            const revealWrong = answered && sel && !correctSet.has(i);
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                disabled={answered}
                aria-pressed={sel}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                  !answered && "border-line hover:border-accent hover:bg-accent-soft/40",
                  answered && "cursor-default",
                  revealCorrect && "border-ok-border bg-ok-soft",
                  revealWrong && "border-danger-border bg-danger-soft",
                  answered && !revealCorrect && !revealWrong && "border-line opacity-55"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-2xs",
                    sel ? "border-accent bg-accent text-white" : "border-line-strong text-ink-faint"
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="leading-snug text-ink-soft">{opt}</span>
                {revealCorrect && (
                  <span className="ml-auto mt-0.5 shrink-0 font-mono text-2xs font-semibold text-ok-ink">✓ correct</span>
                )}
                {revealWrong && (
                  <span className="ml-auto mt-0.5 shrink-0 font-mono text-2xs font-semibold text-danger-ink">✕</span>
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div
            className={cn(
              "animate-fadeUp mt-4 rounded-lg border p-4",
              isCorrect ? "border-ok-border bg-ok-soft" : "border-danger-border bg-danger-soft"
            )}
          >
            <div className={cn("text-xs font-semibold", isCorrect ? "text-ok-ink" : "text-danger-ink")}>
              {isCorrect ? "Correct — here's why it matters" : "Not quite"}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{q.explain}</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {questions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full",
                  i < idx || done ? "bg-accent" : i === idx ? "bg-accent/50" : "bg-line-strong"
                )}
              />
            ))}
          </div>
          {!answered ? (
            <Button variant="primary" size="sm" disabled={selected.length === 0} onClick={submit}>
              Check answer
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={next}>
              {idx + 1 >= questions.length ? "Finish" : "Next question →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
