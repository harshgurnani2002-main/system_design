import { notFound } from "next/navigation";
import Link from "next/link";
import { TRACKS } from "@/content/tracks";
import { trackChapters } from "@/content";
import { TrackProgress, StatusDot } from "./TrackProgress";

export function generateStaticParams() {
  return TRACKS.map((t) => ({ track: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const t = TRACKS.find((x) => x.slug === track);
  return { title: t ? `${t.name} — ${t.level}` : "Track" };
}

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const t = TRACKS.find((x) => x.slug === track);
  if (!t) notFound();
  const chapters = trackChapters(t.slug);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 font-mono text-2xs text-ink-faint">
        <Link href="/academy" className="hover:text-accent">academy</Link>
        <span>/</span>
        <span className="text-ink-mute">learn</span>
        <span>/</span>
        <span className="text-accent">{t.slug}</span>
      </nav>

      <header className="border-b border-line pb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.level}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{t.name}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">{t.blurb}</p>
        <TrackProgress chapters={chapters.map((c) => c.slug)} />
      </header>

      <ol>
        {chapters.map((ch) => (
          <li key={ch.slug}>
            <Link
              href={`/academy/learn/${t.slug}/${ch.slug}`}
              className="group flex items-start gap-4 border-b border-line py-5 transition-colors hover:bg-zinc-50"
            >
              <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-sm text-ink-faint group-hover:text-accent">
                {String(ch.num).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[15px] font-medium text-ink group-hover:text-accent-ink">{ch.title}</span>
                  <span className="font-mono text-2xs text-ink-faint">{ch.minutes} min · {ch.quiz.length} quiz questions</span>
                  <StatusDot slug={ch.slug} />
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-mute">{ch.subtitle}</span>
              </span>
              <svg viewBox="0 0 12 12" className="mt-2 h-3 w-3 shrink-0 text-line-strong transition-all group-hover:translate-x-0.5 group-hover:text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </li>
        ))}
      </ol>

      {chapters.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-line-strong p-10 text-center text-sm text-ink-mute">
          Chapters for this track are being engineered.
        </div>
      )}
    </div>
  );
}
