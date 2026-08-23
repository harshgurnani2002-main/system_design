"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  lang,
  title,
  className,
}: {
  code: string;
  lang?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-[#FCFCFB]",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-line-soft bg-zinc-50/70 px-3.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-2xs uppercase tracking-wide text-ink-faint">
            {lang ?? "text"}
          </span>
          {title && (
            <span className="truncate font-mono text-xs text-ink-mute">{title}</span>
          )}
        </div>
        <button
          onClick={copy}
          aria-label={copied ? "Code copied to clipboard" : `Copy ${title ?? lang ?? "code"} snippet`}
          className="rounded-md px-2 py-1 font-mono text-2xs text-ink-mute transition-colors hover:bg-zinc-200/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          {copied ? "copied ✓" : "copy"}
          <span className="sr-only" aria-live="polite">
            {copied ? "Code successfully copied to clipboard" : ""}
          </span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[0.8125rem] leading-relaxed">
        <code className="font-mono text-ink-soft">{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}

/** Minimal, safe highlighter: comments + strings + a few keywords. */
function highlight(code: string, lang?: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const commentToken = lang === "bash" || lang === "yaml" ? "#" : "//";
    const ci = line.indexOf(commentToken);
    let main = line;
    let comment: string | null = null;
    if (ci >= 0 && !isInsideString(line, ci)) {
      main = line.slice(0, ci);
      comment = line.slice(ci);
    }
    return (
      <div key={i} className="flex">
        <span className="w-7 shrink-0 select-none pr-3 text-right text-zinc-300">
          {i + 1}
        </span>
        <span className="whitespace-pre">
          {colorize(main)}
          {comment && <span className="italic text-zinc-400">{comment}</span>}
          {main === "" && comment === null ? " " : null}
        </span>
      </div>
    );
  });
}

function isInsideString(line: string, idx: number) {
  const before = line.slice(0, idx);
  const quotes = (before.match(/["']/g) ?? []).length;
  return quotes % 2 === 1;
}

const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|import|from|export|async|await|class|new|def|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ON|JOIN|LEFT|GROUP|BY|ORDER|LIMIT|BEGIN|COMMIT|ROLLBACK|ISOLATION|LEVEL|true|false|null|None|True|False)\b/g;

function colorize(s: string): React.ReactNode {
  if (!s) return null;
  const parts: React.ReactNode[] = [];
  const regex = /("[^"]*"|'[^']*')/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(s))) {
    if (m.index > last) parts.push(...keywords(s.slice(last, m.index), key++));
    parts.push(
      <span key={`s${key++}`} className="text-emerald-700">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(...keywords(s.slice(last), key++));
  return parts;
}

function keywords(s: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const regex = new RegExp(KEYWORDS.source, "g");
  let k = 0;
  while ((m = regex.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      <span key={`${baseKey}-${k++}`} className="text-accent">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? <span key={`${baseKey}-t${i}`}>{p}</span> : p
  );
}
