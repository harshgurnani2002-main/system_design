import type { Metadata } from "next";
import Link from "next/link";
import { LABS } from "@/content/labs";
import { LabProgress } from "./LabProgress";

export const metadata: Metadata = {
  title: "Labs",
  description: "Thirteen hands-on labs from URL shortener to simulated production outage.",
};

export default function LabsIndex() {
  const tracks = [...new Set(LABS.map((l) => l.track))];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Hands-on</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Labs</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Build the systems you just studied: real Docker files, real Redis scripts, real chaos. Each lab has
          objectives, tasks, hints and production considerations — designed to run on a laptop.
        </p>
        <LabProgress />
      </header>

      {tracks.map((track) => (
        <section key={track} className="mt-6">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">{track}</h2>
          <ol className="mt-2">
            {LABS.filter((l) => l.track === track).map((lab) => (
              <li key={lab.slug}>
                <Link
                  href={`/academy/labs/${lab.slug}`}
                  className="group flex items-start gap-4 border-b border-line py-4 transition-colors hover:bg-zinc-50"
                >
                  <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-sm text-ink-faint group-hover:text-accent">
                    {String(lab.num).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[15px] font-medium text-ink group-hover:text-accent-ink">{lab.title}</span>
                      <span className="font-mono text-2xs text-ink-faint">{lab.minutes} min · {lab.tasks.length} tasks</span>
                      <LabDoneDot slug={lab.slug} />
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] leading-relaxed text-ink-mute">{lab.objective}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LabDoneDot({ slug }: { slug: string }) {
  return <LabDot slug={slug} />;
}

import { LabDot } from "./LabProgress";
