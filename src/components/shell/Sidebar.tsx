"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TRACKS } from "@/content/tracks";
import { trackChapters } from "@/content";
import { useProgress } from "@/lib/store/progress";

interface NavItem {
  label: string;
  href: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const completed = useProgress((s) => s.completedChapters);

  const groups: NavGroup[] = [
    {
      title: "Learn",
      items: TRACKS.map((t) => ({
        label: t.name,
        href: `/academy/learn/${t.slug}`,
      })),
    },
    {
      title: "Build",
      items: [
        { label: "Real-World Systems", href: "/academy/case-studies" },
        { label: "Architecture Builder", href: "/academy/builder" },
        { label: "System Simulator", href: "/academy/simulator" },
        { label: "Labs", href: "/academy/labs" },
      ],
    },
    {
      title: "Practice",
      items: [
        { label: "Interview & Design Problems", href: "/academy/interview" },
        { label: "Failure Scenarios", href: "/academy/failures" },
        { label: "Glossary", href: "/academy/glossary" },
        { label: "Command Reference", href: "/academy/reference" },
      ],
    },
    {
      title: "Progress",
      items: [
        { label: "Dashboard", href: "/academy" },
        { label: "Progress & Skills", href: "/academy/progress" },
      ],
    },
  ];

  return (
    <nav aria-label="Academy navigation" className="flex h-full flex-col overflow-y-auto px-3 pb-8 pt-4">
      <Link
        href="/"
        className="mb-4 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold tracking-tight text-ink hover:bg-zinc-100"
        onClick={onNavigate}
      >
        <Logo />
      </Link>

      {groups.map((g) => (
        <div key={g.title} className="mb-5">
          <div className="px-2 pb-1.5 font-mono text-2xs font-medium uppercase tracking-widest text-ink-faint">
            {g.title}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/academy" && pathname.startsWith(item.href));
              const isTrack = item.href.startsWith("/academy/learn/");
              const chapters = isTrack ? trackChapters(item.href.split("/").pop()!) : [];
              return (
                <li key={item.href}>
                  <TrackItem item={item} active={active} chapters={chapters} completed={completed} onNavigate={onNavigate} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto rounded-xl border border-line bg-surface p-3">
        <p className="text-2xs leading-relaxed text-ink-mute">
          <span className="font-semibold text-ink">Build → Break → Understand.</span> Every lesson ends in a system you can overload.
        </p>
      </div>
    </nav>
  );
}

function TrackItem({
  item,
  active,
  chapters,
  completed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  chapters: { slug: string; title: string; num: number }[];
  completed: Record<string, number>;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = chapters.length > 0;

  return (
    <div>
      <div className="flex items-center">
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-[13px] transition-colors",
            active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-soft hover:bg-zinc-100 hover:text-ink"
          )}
        >
          {item.label}
        </Link>
        {hasChildren && (
          <button
            aria-label={open ? "Collapse chapters" : "Expand chapters"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded p-1 text-ink-faint hover:bg-zinc-100 hover:text-ink"
          >
            <svg viewBox="0 0 12 12" className={cn("h-3 w-3 transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && open && (
        <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-line pl-2">
          {chapters.map((ch) => (
            <li key={ch.slug}>
              <Link
                href={`${item.href}/${ch.slug}`}
                onClick={onNavigate}
                className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs text-ink-mute transition-colors hover:bg-zinc-100 hover:text-ink"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    completed[`${item.href.split("/").pop()}/${ch.slug}`] !== undefined || completed[ch.slug] ? "bg-ok" : "bg-line-strong group-hover:bg-accent"
                  )}
                />
                <span className="truncate">{ch.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink text-white">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 block" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="10" width="5" height="4" rx="1" fill="currentColor" stroke="none" />
          <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.55" stroke="none" />
          <path d="M4.5 10V6.5h7V9M8 9v0" strokeLinecap="round" />
          <circle cx="8" cy="4" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none select-none">
          System Design<span className="text-accent"> Academy</span>
        </span>
      )}
    </span>
  );
}
