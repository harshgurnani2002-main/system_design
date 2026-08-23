"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { search, type SearchDoc } from "@/content/search";
import { cn } from "@/lib/utils";

const GROUP_ORDER = ["Chapter", "System", "Track", "Concept", "Lab", "Interview", "Tool"] as const;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = useMemo(() => search(q, 14), [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  const go = (doc: SearchDoc) => {
    onClose();
    router.push(doc.href);
  };

  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: results.filter((r) => r.group === g) })).filter(
    (g) => g.items.length > 0
  );
  const flat = grouped.flatMap((g) => g.items);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-zinc-900/30 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search the academy"
    >
      <div className="animate-fadeUp w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, flat.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                if (flat[sel]) go(flat[sel]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder='Search chapters, concepts, labs… try "hot key" or "kafka"'
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            aria-label="Search query"
          />
          <kbd className="rounded border border-line bg-zinc-50 px-1.5 py-0.5 font-mono text-2xs text-ink-faint">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {q && flat.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-ink-mute">
              No results for &ldquo;{q}&rdquo;. Try a concept like <em>quorum</em>, a tech like <em>redis</em>, or a system like <em>instagram</em>.
            </div>
          )}
          {!q && (
            <div className="px-3 py-6">
              <p className="mb-3 px-1 font-mono text-2xs uppercase tracking-widest text-ink-faint">Jump to</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ["Flagship lesson", "/academy/learn/core-design/caching"],
                  ["Instagram case study", "/academy/case-studies/instagram"],
                  ["Architecture Builder", "/academy/builder"],
                  ["Break a system", "/academy/simulator"],
                ].map(([label, href]) => (
                  <button
                    key={href}
                    onClick={() => {
                      onClose();
                      router.push(href);
                    }}
                    className="rounded-lg border border-line px-3 py-2 text-left text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {grouped.map((g) =>
            g.items.map((doc) => {
              const idx = flat.indexOf(doc);
              return (
                <button
                  key={doc.id}
                  role="option"
                  aria-selected={idx === sel}
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => go(doc)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left",
                    idx === sel ? "bg-accent-soft" : "hover:bg-zinc-50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 rounded border px-1.5 py-0.5 font-mono text-2xs leading-none",
                      doc.group === "Chapter" && "border-accent-border bg-accent-soft text-accent-ink",
                      doc.group === "System" && "border-accent-border bg-blue-50 text-accent-ink",
                      doc.group === "Concept" && "border-ok-border bg-ok-soft text-ok-ink",
                      doc.group === "Lab" && "border-warn-border bg-warn-soft text-warn-ink",
                      (doc.group === "Interview" || doc.group === "Track") && "border-line bg-zinc-100 text-ink-soft",
                      doc.group === "Tool" && "border-line-strong bg-surface text-ink-mute"
                    )}
                  >
                    {doc.group}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", idx === sel ? "text-accent-ink" : "text-ink")}>{doc.title}</span>
                    {doc.subtitle && <span className="block truncate text-xs text-ink-mute">{doc.subtitle}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-zinc-50/70 px-4 py-2 font-mono text-2xs text-ink-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
