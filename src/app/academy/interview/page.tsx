import type { Metadata } from "next";
import Link from "next/link";
import { INTERVIEW_QUESTIONS } from "@/content/interview";
import { InterviewProgress } from "./InterviewProgress";

export const metadata: Metadata = {
  title: "Interview & Design Problems",
  description: "Guided system design interview drills: requirements → estimation → architecture → deep dives → failure handling.",
};

const DIFF_TONE = { Easy: "ok", Medium: "warn", Hard: "danger" } as const;

export default function InterviewIndex() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Interview &amp; Design Problems</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Each question follows the real interview arc — requirements, capacity estimation, architecture, deep dives,
          tradeoffs, failure handling — with a checklist you drive yourself and a built-in timer.
        </p>
        <InterviewProgress />
      </header>

      <div className="mb-5 mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">The 40-minute framework</h2>
        <ol className="mt-3 grid gap-2 text-[13px] leading-relaxed text-ink-soft sm:grid-cols-2">
          {[
            ["Requirements", "5 min — functional vs non-functional; write them down, agree scope"],
            ["Estimation", "5 min — QPS, storage, bandwidth, read/write ratio"],
            ["Architecture", "10 min — boxes first, breadth over depth, data flows labeled"],
            ["Deep dive", "12 min — the interviewer picks a component; go one level deeper"],
            ["Tradeoffs", "4 min — why THIS choice; what you'd change at 10× scale"],
            ["Failure", "4 min — what breaks first; how it degrades; how you'd know"],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2">
              <span className="font-semibold text-accent">{t}</span>
              <span className="text-ink-mute">— {d}</span>
            </li>
          ))}
        </ol>
      </div>

      <ol>
        {INTERVIEW_QUESTIONS.map((q) => (
          <li key={q.slug}>
            <Link href={`/academy/interview/${q.slug}`} className="group flex items-start gap-4 border-b border-line py-4 transition-colors hover:bg-zinc-50">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[15px] font-medium text-ink group-hover:text-accent-ink">{q.title}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-2xs ${
                      DIFF_TONE[q.difficulty] === "ok"
                        ? "border-ok-border bg-ok-soft text-ok-ink"
                        : DIFF_TONE[q.difficulty] === "warn"
                          ? "border-warn-border bg-warn-soft text-warn-ink"
                          : "border-danger-border bg-danger-soft text-danger-ink"
                    }`}
                  >
                    {q.difficulty}
                  </span>
                  <span className="font-mono text-2xs text-ink-faint">{q.minutes} min</span>
                  <InterviewDoneDot slug={q.slug} />
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-mute">{q.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InterviewDoneDot({ slug }: { slug: string }) {
  return <InterviewProgressDot slug={slug} />;
}

import { InterviewProgressDot } from "./InterviewProgress";
