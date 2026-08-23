import type { Chapter, Track } from "@/lib/types";
import { TRACKS } from "./tracks";
import { foundationsChapters } from "./chapters/foundations";
import { coreChaptersA } from "./chapters/core-a";
import { coreChaptersB } from "./chapters/core-b";
import { dataChapters } from "./chapters/data";
import { distChapters } from "./chapters/dist";
import { scaleChapters } from "./chapters/scale";
import { infraChapters } from "./chapters/infra";

const ALL: Chapter[] = [
  ...foundationsChapters,
  ...coreChaptersA,
  ...coreChaptersB,
  ...dataChapters,
  ...distChapters,
  ...scaleChapters,
  ...infraChapters,
];

export const CHAPTERS: Chapter[] = ALL;

export function getTrack(slug: string): Track | undefined {
  return TRACKS.find((t) => t.slug === slug);
}

export function trackChapters(trackSlug: string): Chapter[] {
  return ALL.filter((c) => c.track === trackSlug).sort((a, b) => a.num - b.num);
}

export function getChapter(trackSlug: string, chapterSlug: string): Chapter | undefined {
  return ALL.find((c) => c.track === trackSlug && c.slug === chapterSlug);
}

export function chapterHref(ch: Chapter): string {
  return `/academy/learn/${ch.track}/${ch.slug}`;
}

/** Flat ordered list across tracks for prev/next navigation. */
export function flatCurriculum(): { chapter: Chapter; track: Track }[] {
  const out: { chapter: Chapter; track: Track }[] = [];
  for (const t of TRACKS) {
    for (const c of trackChapters(t.slug)) out.push({ chapter: c, track: t });
  }
  return out;
}

export { TRACKS };
