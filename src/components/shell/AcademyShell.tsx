"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, Logo } from "@/components/shell/Sidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { CHAPTERS } from "@/content";
import { useProgress } from "@/lib/store/progress";

export function AcademyShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();
  const completedCount = useProgress((s) => Object.keys(s.completedChapters).length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-paper lg:block">
        <Sidebar />
      </aside>

      {/* mobile sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-paper shadow-pop">
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur md:px-6">
          <button
            className="rounded-md p-1.5 text-ink-mute hover:bg-zinc-100 lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation menu"
          >
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
            </svg>
          </button>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/" className="lg:hidden"><Logo compact /></Link>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink-faint transition-colors hover:border-line-strong hover:text-ink-mute"
            aria-label="Open search (Command+K)"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            <span className="flex-1 truncate">Search chapters, concepts, labs…</span>
            <kbd className="hidden shrink-0 rounded border border-line bg-zinc-50 px-1.5 py-0.5 font-mono text-2xs sm:block">⌘K</kbd>
          </button>
          <div className="ml-auto hidden items-center gap-2 sm:flex" title={`${completedCount} of ${CHAPTERS.length} chapters completed`}>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${(completedCount / CHAPTERS.length) * 100}%` }}
              />
            </div>
            <span className="font-mono text-2xs text-ink-mute">
              {completedCount}/{CHAPTERS.length}
            </span>
          </div>
        </header>

        <main id="main">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
