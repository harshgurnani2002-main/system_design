"use client";

import { useMemo } from "react";
import type { Block } from "@/lib/types";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import { Callout } from "@/components/ui/Callout";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { QuizCard } from "@/components/sims/QuizCard";
import { InstagramLikes } from "@/components/sims/InstagramLikes";
import { CapacityCalc, TokenBucket, ReplicationLag } from "@/components/sims/MiniSims";

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.t) {
    case "p":
      return (
        <p className="prose-academy">
          <Inline md={block.md} />
        </p>
      );
    case "h":
      return (
        <h3 className="mt-10 border-b border-line-soft pb-2 text-lg font-semibold tracking-tight text-ink first:mt-0">
          {block.text}
        </h3>
      );
    case "list":
      return block.ordered ? (
        <ol className="prose-academy ml-1 list-decimal space-y-2 pl-5 marker:font-mono marker:text-ink-faint">
          {block.items.map((it, i) => (
            <li key={i} className="pl-1"><Inline md={it} /></li>
          ))}
        </ol>
      ) : (
        <ul className="prose-academy space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="relative pl-5 before:absolute before:left-0 before:top-[0.72em] before:h-1.5 before:w-1.5 before:rounded-sm before:bg-accent/70">
              <Inline md={it} />
            </li>
          ))}
        </ul>
      );
    case "callout":
      return <Callout kind={block.kind} title={block.title} md={block.md} />;
    case "code":
      return <CodeBlock code={block.code} lang={block.lang} title={block.title} />;
    case "table":
      return (
        <figure className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-zinc-50/80">
                  {block.head.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 font-semibold text-ink">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b border-line-soft last:border-0 hover:bg-zinc-50/50">
                    {row.map((cell, j) => (
                      <td key={j} className={j === 0 ? "px-4 py-2.5 font-medium text-ink" : "px-4 py-2.5 text-ink-mute"}>
                        <Inline md={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="border-t border-line-soft bg-zinc-50/50 px-4 py-2 font-mono text-2xs text-ink-faint">{block.caption}</figcaption>
          )}
        </figure>
      );
    case "tradeoff":
      return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-zinc-50/80">
                <th className="px-4 py-2.5 font-semibold">Property</th>
                <th className="px-4 py-2.5 font-semibold text-accent-ink">{block.a}</th>
                <th className="px-4 py-2.5 font-semibold text-accent-ink">{block.b}</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map(([prop, av, bv], i) => (
                <tr key={i} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{prop}</td>
                  <td className="px-4 py-2.5 text-ink-mute">{av}</td>
                  <td className="px-4 py-2.5 text-ink-mute">{bv}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-accent-ink">
            <strong>When to actually choose:</strong> {block.verdict}
          </div>
        </div>
      );
    case "diagram":
      return (
        <figure>
          <ArchCanvas graph={block.graph} height={block.height ?? 280} mode="static" />
          {block.caption && (
            <figcaption className="mt-2 text-center font-mono text-2xs leading-relaxed text-ink-faint">{block.caption}</figcaption>
          )}
        </figure>
      );
    case "sim":
      return <SimMount sim={block.sim} />;
    default:
      return null;
  }
}

function SimMount({ sim }: { sim: string }) {
  switch (sim) {
    case "instagram-likes":
      return <InstagramLikes />;
    case "capacity-calc":
      return <CapacityCalc />;
    case "token-bucket":
      return <TokenBucket />;
    case "replication-lag":
      return <ReplicationLag />;
    default:
      return null;
  }
}

/** Inline markdown: **bold**, `code` */
export function Inline({ md }: { md: string }) {
  const parts = useMemo(() => md.split(/(\*\*[^*]+\*\*|`[^`]+`)/g), [md]);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
