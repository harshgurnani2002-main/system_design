"use client";

import Link from "next/link";
import { TRACKS } from "@/content/tracks";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const TRACK_HIGHLIGHTS: Record<
  string,
  {
    icon: string;
    highlights: string[];
    tier: string;
  }
> = {
  foundations: {
    icon: "🌐",
    highlights: ["DNS Resolution & Anycast", "TCP 3-Way Handshake", "TLS 1.3 Key Exchange", "HTTP/2 vs HTTP/3 (QUIC)"],
    tier: "Level 0",
  },
  "core-design": {
    icon: "🧱",
    highlights: ["Capacity Fermi Math", "Layer 4 vs Layer 7 LBs", "Cache-Aside & Write-Through", "Token Bucket Rate Limiters"],
    tier: "Levels 1–2",
  },
  "data-systems": {
    icon: "💾",
    highlights: ["PostgreSQL B-Tree & WAL", "Read Replicas & Connection Pools", "Kafka Partitioning & Offset Commit", "Transactional Outbox Pattern"],
    tier: "Level 3",
  },
  distributed: {
    icon: "🔀",
    highlights: ["CAP Theorem & PACELC", "Strong vs Eventual Consistency", "Raft Leader Election & Consensus", "Vector Clocks & Split-Brain"],
    tier: "Level 4",
  },
  scalability: {
    icon: "📈",
    highlights: ["Range vs Hash Database Sharding", "Consistent Hashing Ring & V-Nodes", "Multi-Tier Caching Hierarchy", "Global Anycast Edge Steering"],
    tier: "Level 5",
  },
  reliability: {
    icon: "🛡️",
    highlights: ["Circuit Breakers (Open/Half-Open)", "Exponential Backoff + Full Jitter", "Bulkhead Isolation Patterns", "Chaos Engineering & Load Shedding"],
    tier: "Production",
  },
  advanced: {
    icon: "⚡",
    highlights: ["Saga Orchestration vs Choreography", "CQRS & Event Sourcing Models", "Two-Phase Commit (2PC) Tradeoffs", "Distributed Lock Managers (Redlock)"],
    tier: "Principal",
  },
  infrastructure: {
    icon: "🚀",
    highlights: ["Docker Multi-Stage Builds", "Kubernetes Pods, Services & Ingress", "GitOps & CI/CD Deployment Pipelines", "Distributed Tracing (OpenTelemetry)"],
    tier: "Platform",
  },
};

export function CurriculumRoadmap() {
  return (
    <section aria-labelledby="curriculum-heading" className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
            Structured Learning Path
          </span>
          <h2 id="curriculum-heading" className="mt-1 text-2xl font-bold tracking-tight text-ink md:text-3xl">
            From Request Lifecycle to Principal Distributed Architecture
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft leading-relaxed">
            Eight interconnected tracks designed to build rigorous engineering mental models through interactive simulation, not rote memorization.
          </p>
        </div>

        <Link
          href="/academy"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover"
        >
          View full curriculum index →
        </Link>
      </div>

      {/* Grid of 8 Tracks */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRACKS.map((t, idx) => {
          const meta = TRACK_HIGHLIGHTS[t.slug] || {
            icon: "📚",
            highlights: ["Core concepts", "Interactive labs", "Failure simulations"],
            tier: t.level,
          };

          return (
            <Link
              key={t.slug}
              href={`/academy/learn/${t.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 transition-all hover:border-accent-border hover:shadow-pop"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl" aria-hidden>{meta.icon}</span>
                  <span className="rounded-md border border-line bg-zinc-50 px-2 py-0.5 font-mono text-2xs font-semibold text-ink-mute">
                    {meta.tier}
                  </span>
                </div>

                <div className="mt-3 font-mono text-2xs uppercase text-ink-faint">
                  Track 0{idx + 1}
                </div>
                <h3 className="mt-0.5 text-base font-bold text-ink group-hover:text-accent transition-colors">
                  {t.name}
                </h3>
                <p className="mt-2 text-xs text-ink-soft leading-relaxed line-clamp-2">
                  {t.blurb}
                </p>

                {/* Highlights */}
                <ul className="mt-4 space-y-1.5 border-t border-line/60 pt-3 text-2xs text-ink-mute">
                  {meta.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-accent" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex items-center justify-between pt-2 text-2xs font-semibold text-accent group-hover:text-accent-hover">
                <span>Start Track</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
