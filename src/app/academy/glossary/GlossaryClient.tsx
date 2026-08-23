"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GLOSSARY } from "@/content/glossary";
import { cn } from "@/lib/utils";

export function GlossaryClient() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("term"));

  const categories = useMemo(() => ["all", ...new Set(GLOSSARY.map((g) => g.category))], []);
  const filtered = useMemo(
    () =>
      GLOSSARY.filter((g) => {
        const matchCat = cat === "all" || g.category === cat;
        const matchQ =
          !q ||
          `${g.term} ${g.simple} ${g.technical} ${g.related.join(" ")}`.toLowerCase().includes(q.toLowerCase());
        return matchCat && matchQ;
      }).sort((a, b) => a.term.localeCompare(b.term)),
    [q, cat]
  );

  const selected = GLOSSARY.find((g) => g.id === selectedId);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* list */}
      <div className="min-w-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter terms…"
          aria-label="Filter glossary terms"
          className="mb-3 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-2xs transition-colors",
                cat === c ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-mute hover:border-line-strong"
              )}
            >
              {c === "all" ? "all" : c}
            </button>
          ))}
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {filtered.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => setSelectedId(g.id)}
                className={cn("w-full px-4 py-2.5 text-left transition-colors", selectedId === g.id ? "bg-accent-soft" : "hover:bg-zinc-50")}
              >
                <span className={cn("block text-sm font-medium", selectedId === g.id ? "text-accent-ink" : "text-ink")}>{g.term}</span>
                <span className="block truncate text-xs text-ink-mute">{g.simple}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-ink-mute">No terms match.</li>
          )}
        </ul>
      </div>

      {/* detail */}
      <div className="min-w-0 lg:sticky lg:top-[4.5rem] lg:self-start" aria-live="polite">
        {selected ? (
          <article key={selected.id} className="animate-fadeUp space-y-4 rounded-xl border border-line bg-surface p-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">{selected.term}</h2>
              <p className="mt-0.5 font-mono text-2xs uppercase tracking-widest text-accent">{selected.category}</p>
            </div>

            <section>
              <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">In one sentence</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{selected.simple}</p>
            </section>

            <section>
              <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Technical definition</h3>
              <p className="prose-academy mt-1 text-sm leading-relaxed">{selected.technical}</p>
            </section>

            <section>
              <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Real-world example</h3>
              <p className="mt-1 rounded-lg border border-accent-border bg-accent-soft/50 px-4 py-3 text-sm leading-relaxed text-accent-ink">
                {selected.example}
              </p>
            </section>

            <section>
              <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Related</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.related.map((r) => {
                  const rel = GLOSSARY.find((g) => g.id === r);
                  return (
                    <button
                      key={r}
                      onClick={() => rel && setSelectedId(rel.id)}
                      className="rounded-md border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      {rel?.term ?? r}
                    </button>
                  );
                })}
              </div>
            </section>
          </article>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong p-10 text-center text-sm text-ink-mute">
            Select a term to see its definition, example and connections.
          </div>
        )}
      </div>
    </div>
  );
}
