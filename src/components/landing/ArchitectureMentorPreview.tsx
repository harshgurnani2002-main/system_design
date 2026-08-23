"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import type { Graph } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAIVE_GRAPH: Graph = {
  nodes: [
    { id: "client", label: "Mobile Client", sub: "Direct Traffic", kind: "client", x: 20, y: 140 },
    { id: "monolith", label: "Single Monolith", sub: "App + Background Jobs", kind: "app", x: 300, y: 140 },
    { id: "pg_single", label: "Single Postgres", sub: "NO REPLICA (SPOF)", kind: "data", x: 600, y: 140 },
    { id: "smtp", label: "External SMTP", sub: "Sync call 1.2s", kind: "infra", x: 600, y: 15 },
  ],
  edges: [
    { from: "client", to: "monolith", label: "HTTP direct", flow: true },
    { from: "monolith", to: "pg_single", label: "sync queries", flow: true },
    { from: "monolith", to: "smtp", label: "blocking email send" },
  ],
};

const HARDENED_GRAPH: Graph = {
  nodes: [
    { id: "client", label: "Mobile Client", sub: "TLS · Token Auth", kind: "client", x: 20, y: 150 },
    { id: "lb", label: "Edge Gateway / LB", sub: "WAF · Rate Limit", kind: "app", x: 230, y: 150 },
    { id: "api_cluster", label: "Stateless APIs", sub: "Auto-scaled ×8", kind: "app", x: 440, y: 150 },
    { id: "redis_cache", label: "Redis Cluster", sub: "Session & Hot Reads", kind: "cache", x: 440, y: 20 },
    { id: "queue", label: "Kafka Event Log", sub: "Async decoupling", kind: "queue", x: 660, y: 20 },
    { id: "worker", label: "Email Worker", sub: "Consumes async", kind: "app", x: 880, y: 20 },
    { id: "pg_primary", label: "Postgres Primary", sub: "Writes & Mutex", kind: "data", x: 660, y: 150 },
    { id: "pg_replica", label: "Read Replicas ×2", sub: "Offloads 85% reads", kind: "data", x: 660, y: 280 },
  ],
  edges: [
    { from: "client", to: "lb", label: "HTTPS", flow: true },
    { from: "lb", to: "api_cluster", label: "least-conn", flow: true },
    { from: "api_cluster", to: "redis_cache", label: "~1ms read", flow: true },
    { from: "api_cluster", to: "pg_primary", label: "writes", flow: true },
    { from: "api_cluster", to: "queue", label: "async event", flow: true },
    { from: "queue", to: "worker", label: "batch process", flow: true },
    { from: "pg_primary", to: "pg_replica", label: "stream WAL", dashed: true },
    { from: "api_cluster", to: "pg_replica", label: "read queries", flow: true },
  ],
};

const LINT_ISSUES_NAIVE = [
  {
    severity: "critical",
    title: "Single Point of Failure (SPOF) on Database",
    description: "PostgreSQL has 0 standby or read replicas. Any host crash or disk failure will cause complete data unavailability.",
  },
  {
    severity: "critical",
    title: "Synchronous Third-Party Dependency in Hot Request Path",
    description: "Sending emails via SMTP synchronously inside checkout API adds 800ms–2000ms latency to every user order.",
  },
  {
    severity: "warning",
    title: "No Caching Layer in Front of Database",
    description: "Every read hits disk storage directly, causing database connection pool saturation under 2,000 concurrent users.",
  },
  {
    severity: "warning",
    title: "Missing Load Balancer & Edge Rate Limiting",
    description: "App cannot perform zero-downtime rolling deployments and is vulnerable to unmitigated DDoS spikes.",
  },
];

const LINT_RESOLUTIONS = [
  {
    title: "Multi-AZ Replication & Failover Active",
    description: "Primary streams WAL logs to 2 read replicas. Read traffic is distributed across replicas with automatic failover.",
  },
  {
    title: "Async Decoupling with Event Queue",
    description: "Email notifications and image processing moved off the critical path into Kafka workers.",
  },
  {
    title: "Redis Sub-Millisecond Cache Layer",
    description: "90% of read queries served from in-memory cache in ~1ms.",
  },
  {
    title: "Edge API Gateway with Token Bucket Rate Limiting",
    description: "Traffic scrubbed at edge; enables seamless zero-downtime canary rollouts.",
  },
];

export function ArchitectureMentorPreview() {
  const [architectureState, setArchitectureState] = useState<"naive" | "hardened">("hardened");

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      {/* Header */}
      <div className="border-b border-line bg-zinc-50/80 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
                Architecture Mentor
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-2xs font-semibold text-blue-800">
                Built-in Engineering Linter
              </span>
            </div>
            <h3 className="mt-0.5 text-base font-semibold text-ink sm:text-lg">
              Drag-and-Drop Canvas with Real-Time Architecture Auditing
            </h3>
          </div>

          <Link
            href="/academy/builder"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
          >
            Open Architecture Canvas →
          </Link>
        </div>

        {/* Toggle between states */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-ink-mute">Compare Architecture:</span>
          <div className="flex rounded-lg border border-line bg-zinc-200/60 p-0.5">
            <button
              type="button"
              onClick={() => setArchitectureState("naive")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all focus-visible:outline-accent",
                architectureState === "naive"
                  ? "bg-red-600 text-white font-semibold shadow-xs"
                  : "text-ink-mute hover:text-ink hover:bg-surface/50"
              )}
            >
              ⚠️ Vulnerable Architecture (4 Linter Warnings)
            </button>
            <button
              type="button"
              onClick={() => setArchitectureState("hardened")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all focus-visible:outline-accent",
                architectureState === "hardened"
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : "text-ink-mute hover:text-ink hover:bg-surface/50"
              )}
            >
              ✅ Production Hardened (0 Errors)
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas + Mentor Linter Split View */}
      <div className="grid gap-0 lg:grid-cols-12">
        {/* Visual Graph View (7 cols) */}
        <div className="border-b border-line p-3 lg:col-span-7 lg:border-b-0 lg:border-r grid-paper bg-paper">
          <ArchCanvas
            graph={architectureState === "naive" ? NAIVE_GRAPH : HARDENED_GRAPH}
            mode="explore"
            height={360}
          />
        </div>

        {/* Linter Rule Findings Drawer (5 cols) */}
        <div className="p-4 sm:p-6 lg:col-span-5 bg-surface">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  architectureState === "naive" ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                )}
                aria-hidden
              />
              <span className="font-mono text-xs font-bold uppercase text-ink">
                Architecture Mentor Linter
              </span>
            </div>
            <span className="font-mono text-2xs text-ink-mute">
              {architectureState === "naive" ? "4 issues found" : "All checks passed"}
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            {architectureState === "naive"
              ? LINT_ISSUES_NAIVE.map((issue, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs text-red-950 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-red-900">{issue.title}</span>
                      <span className="rounded bg-red-200/80 px-1.5 py-0.2 font-mono text-2xs uppercase font-bold text-red-800">
                        {issue.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs leading-relaxed text-red-800/90">
                      {issue.description}
                    </p>
                  </div>
                ))
              : LINT_RESOLUTIONS.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950 transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="font-semibold text-emerald-900">{item.title}</span>
                    </div>
                    <p className="mt-1 text-2xs leading-relaxed text-emerald-800/90">
                      {item.description}
                    </p>
                  </div>
                ))}
          </div>

          <div className="mt-4 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() =>
                setArchitectureState(architectureState === "naive" ? "hardened" : "naive")
              }
              className="w-full rounded-lg bg-zinc-900 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              {architectureState === "naive"
                ? "✨ Auto-Apply Architecture Fixes"
                : "↺ Revert to Naive Architecture"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
