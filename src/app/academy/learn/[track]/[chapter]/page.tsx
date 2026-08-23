import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TRACKS } from "@/content/tracks";
import { getTrack, trackChapters, getChapter } from "@/content";
import { BlockRenderer } from "@/components/chapter/BlockRenderer";
import { ChapterWrapUp } from "./ChapterWrapUp";

export function generateStaticParams() {
  const out: { track: string; chapter: string }[] = [];
  for (const t of TRACKS) {
    for (const ch of trackChapters(t.slug)) out.push({ track: t.slug, chapter: ch.slug });
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string; chapter: string }>;
}): Promise<Metadata> {
  const { track, chapter } = await params;
  const ch = getChapter(track, chapter);
  return ch ? { title: ch.title, description: ch.subtitle } : { title: "Chapter" };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ track: string; chapter: string }>;
}) {
  const { track, chapter } = await params;
  const t = getTrack(track);
  const ch = getChapter(track, chapter);
  if (!t || !ch) notFound();

  const siblings = trackChapters(track);
  const idx = siblings.findIndex((c) => c.slug === chapter);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  // flat curriculum navigation across tracks
  const flat = TRACKS.flatMap((tr) => trackChapters(tr.slug));
  const flatIdx = flat.findIndex((c) => c.track === track && c.slug === chapter);
  const flatNext = flatIdx >= 0 && flatIdx < flat.length - 1 ? flat[flatIdx + 1] : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 font-mono text-2xs text-ink-faint">
        <Link href="/academy" className="hover:text-accent">academy</Link>
        <span>/</span>
        <Link href={`/academy/learn/${track}`} className="hover:text-accent">{t.name}</Link>
        <span>/</span>
        <span className="text-accent">{ch.slug}</span>
      </nav>

      <header className="border-b border-line pb-7">
        <div className="flex flex-wrap items-center gap-2 font-mono text-2xs text-ink-faint">
          <span>{t.level}</span>
          <span>·</span>
          <span>Chapter {ch.num}</span>
          <span>·</span>
          <span>{ch.minutes} min read</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink md:text-[2.5rem] md:leading-[1.15]">
          {ch.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">{ch.subtitle}</p>
      </header>

      <article className="space-y-6 py-8">
        {ch.blocks.map((b, i) => (
          <BlockRenderer key={i} block={b} />
        ))}
      </article>

      <ChapterWrapUp
        trackSlug={track}
        trackName={t.name}
        slug={ch.slug}
        quiz={ch.quiz}
        exercise={ch.exercise ?? null}
        concepts={ch.concepts}
        prev={prev ? { title: prev.title, href: `/academy/learn/${prev.track}/${prev.slug}` } : null}
        next={
          next
            ? { title: next.title, href: `/academy/learn/${next.track}/${next.slug}` }
            : flatNext
              ? { title: flatNext.title, href: `/academy/learn/${flatNext.track}/${flatNext.slug}` }
              : { title: "Architecture Builder", href: "/academy/builder" }
        }
      />
    </div>
  );
}
