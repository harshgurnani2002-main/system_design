import { CHAPTERS, TRACKS, chapterHref } from "./index";
import { GLOSSARY } from "./glossary";
import { LABS } from "./labs";
import { INTERVIEW_QUESTIONS } from "./interview";
import { SYSTEMS } from "./systems";

export interface SearchDoc {
  id: string;
  title: string;
  subtitle?: string;
  group: "Chapter" | "Track" | "Concept" | "Lab" | "Interview" | "System" | "Tool";
  href: string;
  keywords: string;
}

let INDEX: SearchDoc[] | null = null;

function build(): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const t of TRACKS) {
    docs.push({
      id: `track-${t.slug}`,
      title: t.name,
      subtitle: `${t.level} · ${t.blurb}`,
      group: "Track",
      href: `/academy/learn/${t.slug}`,
      keywords: `${t.name} ${t.blurb} ${t.level}`.toLowerCase(),
    });
  }

  for (const c of CHAPTERS) {
    docs.push({
      id: `ch-${c.track}-${c.slug}`,
      title: c.title,
      subtitle: c.subtitle,
      group: "Chapter",
      href: chapterHref(c),
      keywords: `${c.title} ${c.subtitle} ${c.concepts.join(" ")}`.toLowerCase(),
    });
  }

  for (const term of GLOSSARY) {
    docs.push({
      id: `gl-${term.id}`,
      title: term.term,
      subtitle: term.simple,
      group: "Concept",
      href: `/academy/glossary?term=${term.id}`,
      keywords: `${term.term} ${term.simple} ${term.category} ${term.related.join(" ")}`.toLowerCase(),
    });
  }

  for (const lab of LABS) {
    docs.push({
      id: `lab-${lab.slug}`,
      title: `Lab ${lab.num}: ${lab.title}`,
      subtitle: lab.objective,
      group: "Lab",
      href: `/academy/labs/${lab.slug}`,
      keywords: `${lab.title} ${lab.objective} ${lab.prereqs.join(" ")}`.toLowerCase(),
    });
  }

  for (const q of INTERVIEW_QUESTIONS) {
    docs.push({
      id: `iv-${q.slug}`,
      title: q.title,
      subtitle: q.summary,
      group: "Interview",
      href: `/academy/interview/${q.slug}`,
      keywords: `${q.title} ${q.summary} interview design`.toLowerCase(),
    });
  }

  for (const sys of SYSTEMS) {
    docs.push({
      id: `sys-${sys.slug}`,
      title: `${sys.name} — case study`,
      subtitle: sys.tagline,
      group: "System",
      href: `/academy/case-studies/system/${sys.slug}`,
      keywords: `${sys.name} ${sys.category} ${sys.difficulty} case study system design ${sys.tagline}`.toLowerCase(),
    });
  }

  docs.push(
    {
      id: "builder",
      title: "Architecture Builder",
      subtitle: "Drag-and-drop canvas with design review intelligence",
      group: "Tool",
      href: "/academy/builder",
      keywords: "builder architecture drag drop canvas design lint",
    },
    {
      id: "simulator",
      title: "System Simulator",
      subtitle: "Overload systems and watch cascading failure",
      group: "Tool",
      href: "/academy/simulator",
      keywords: "simulator traffic load failure cascade metrics trace",
    },
    {
      id: "reference",
      title: "Command Reference Sheets",
      subtitle: "docker · kubectl · git · psql · redis-cli · kafka",
      group: "Tool",
      href: "/academy/reference",
      keywords: "cheatsheet commands reference docker kubectl git redis kafka sql",
    },
    {
      id: "progress",
      title: "Progress & Skill Map",
      group: "Tool",
      href: "/academy/progress",
      keywords: "progress skills bookmarks notes",
    }
  );

  return docs;
}

export function searchIndex(): SearchDoc[] {
  if (!INDEX) INDEX = build();
  return INDEX;
}

/** Lightweight fuzzy-ish scoring search across the index. */
export function search(query: string, limit = 12): SearchDoc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored: { doc: SearchDoc; score: number }[] = [];

  for (const doc of searchIndex()) {
    let score = 0;
    const title = doc.title.toLowerCase();
    for (const term of terms) {
      if (title === term) score += 60;
      else if (title.startsWith(term)) score += 40;
      else if (title.includes(term)) score += 25;
      else if (doc.keywords.includes(term)) score += 10;
      else {
        // allow 1 typo via simple subsequence check
        if (hasSubsequence(title, term)) score += 4;
        else {
          score = -1;
          break;
        }
      }
    }
    if (score > 0) scored.push({ doc, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc);
}

function hasSubsequence(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return i === needle.length && needle.length > 2;
}
