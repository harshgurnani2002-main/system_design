"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type IncidentKey = "stampede" | "retry_storm" | "kafka_lag";

interface Incident {
  title: string;
  symptom: string;
  trigger: string;
  brokenMetrics: {
    latency: string;
    errorRate: string;
    cpu: string;
    status: "CRITICAL" | "DEGRADED";
  };
  fixedMetrics: {
    latency: string;
    errorRate: string;
    cpu: string;
    status: "HEALTHY";
  };
  fixName: string;
  fixExplanation: string;
  diagramPath: string;
}

const INCIDENTS: Record<IncidentKey, Incident> = {
  stampede: {
    title: "1. Thundering Herd (Cache Stampede)",
    symptom: "A viral homepage key expires in Redis. 40,000 concurrent requests simultaneously miss cache and bombard PostgreSQL.",
    trigger: "TTL Expired on Hot Key 'feed:home:v2'",
    brokenMetrics: {
      latency: "3,850ms",
      errorRate: "42.8%",
      cpu: "99.4%",
      status: "CRITICAL",
    },
    fixedMetrics: {
      latency: "8ms",
      errorRate: "0.0%",
      cpu: "14.2%",
      status: "HEALTHY",
    },
    fixName: "Activate SingleFlight Mutex + Probabilistic Early Expiration (XFetch)",
    fixExplanation:
      "Only 1 worker thread is allowed to recompute the cache while all other 39,999 requests await the single result. XFetch proactively refreshes the key in the background 30s before expiration.",
    diagramPath: "Redis → Mutex Lock → Single DB Query → Broadcast",
  },
  retry_storm: {
    title: "2. Cascading Retry Amplification Storm",
    symptom: "A downstream payment provider suffers a 250ms blip. Frontend clients aggressively retry 3x immediately without backoff.",
    trigger: "Transient Downstream Timeout → 3× Linear Retries",
    brokenMetrics: {
      latency: "5,200ms",
      errorRate: "68.5%",
      cpu: "100.0%",
      status: "CRITICAL",
    },
    fixedMetrics: {
      latency: "45ms",
      errorRate: "0.1%",
      cpu: "22.0%",
      status: "HEALTHY",
    },
    fixName: "Deploy Circuit Breaker + Exponential Backoff with Full Jitter",
    fixExplanation:
      "Circuit breaker trips OPEN in 40ms when error threshold hits 20%, returning instant fallback responses. Exponential backoff + randomized jitter spreads retries evenly across time.",
    diagramPath: "Client → Circuit Breaker (OPEN) → Fallback Cache",
  },
  kafka_lag: {
    title: "3. Event Queue Partition Lag & Backpressure",
    symptom: "High-resolution 4K video uploads overwhelm the video transcoding worker fleet, causing 900,000 unconsumed messages.",
    trigger: "Queue Ingestion (50k/s) > Consumer Processing (4k/s)",
    brokenMetrics: {
      latency: "42 mins lag",
      errorRate: "19.2%",
      cpu: "94.0%",
      status: "DEGRADED",
    },
    fixedMetrics: {
      latency: "< 2.5s lag",
      errorRate: "0.0%",
      cpu: "38.0%",
      status: "HEALTHY",
    },
    fixName: "Trigger HPA Consumer Auto-scaling + Batch Flush + DLQ Isolation",
    fixExplanation:
      "Kubernetes HPA scales consumer pods from 4 to 32 instances based on Kafka lag metrics. Poison pill tasks exceeding 3 retries are isolated into a Dead Letter Queue (DLQ).",
    diagramPath: "Kafka Partitions (0..31) → 32 Scaled Workers → DLQ",
  },
};

export function ChaosSimulatorPreview() {
  const [selectedKey, setSelectedKey] = useState<IncidentKey>("stampede");
  const [isBroken, setIsBroken] = useState<boolean>(true);

  const incident = INCIDENTS[selectedKey];
  const metrics = isBroken ? incident.brokenMetrics : incident.fixedMetrics;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      {/* Top Header */}
      <div className="border-b border-line bg-zinc-50/80 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-danger font-semibold">
                Break The System
              </span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-mono text-2xs font-semibold text-red-800">
                Production Incident Drills
              </span>
            </div>
            <h3 className="mt-0.5 text-base font-semibold text-ink sm:text-lg">
              Live Failure Injection &amp; Resilience Lab
            </h3>
          </div>

          <Link
            href="/academy/failures"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
          >
            Explore all 12 Failure Labs →
          </Link>
        </div>

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="Failure scenarios"
          className="mt-3 flex flex-wrap items-center gap-1 rounded-lg bg-zinc-200/60 p-1"
        >
          {(Object.keys(INCIDENTS) as IncidentKey[]).map((key) => {
            const isSel = selectedKey === key;
            return (
              <button
                key={key}
                role="tab"
                id={`incident-tab-${key}`}
                aria-selected={isSel}
                aria-controls={`incident-panel-${key}`}
                onClick={() => {
                  setSelectedKey(key);
                  setIsBroken(true);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-accent",
                  isSel
                    ? "bg-surface text-ink shadow-sm ring-1 ring-black/5 font-semibold"
                    : "text-ink-mute hover:text-ink hover:bg-surface/50"
                )}
              >
                {key === "stampede" && "⚡ Cache Stampede"}
                {key === "retry_storm" && "💣 Retry Amplification"}
                {key === "kafka_lag" && "🛑 Kafka Consumer Lag"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Incident Playground Body */}
      <div
        role="tabpanel"
        id={`incident-panel-${selectedKey}`}
        aria-labelledby={`incident-tab-${selectedKey}`}
        className="p-4 sm:p-6"
      >
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Incident Description & Action Controls (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-xl border border-line bg-zinc-50/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink">{incident.title}</h4>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-mono text-2xs font-bold",
                    metrics.status === "CRITICAL"
                      ? "border-red-300 bg-red-50 text-red-700 animate-pulse"
                      : metrics.status === "DEGRADED"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800"
                  )}
                >
                  STATUS: {metrics.status}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{incident.symptom}</p>
              <div className="mt-2 rounded-md bg-zinc-200/60 px-2.5 py-1 font-mono text-2xs text-ink-mute">
                Trigger: <span className="font-semibold text-ink">{incident.trigger}</span>
              </div>
            </div>

            {/* Interactive Chaos Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBroken(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-all shadow-xs",
                  isBroken
                    ? "border-red-300 bg-red-600 text-white ring-2 ring-red-300"
                    : "border-line bg-surface text-ink hover:bg-zinc-50"
                )}
              >
                <span>💥</span>
                <span>Trigger Incident Breakdown</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBroken(false)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-all shadow-xs",
                  !isBroken
                    ? "border-emerald-300 bg-emerald-600 text-white ring-2 ring-emerald-300"
                    : "border-line bg-surface text-ink hover:bg-zinc-50"
                )}
              >
                <span>🛡️</span>
                <span>Apply Architectural Resilience Pattern</span>
              </button>
            </div>

            {/* Explanation box */}
            <div
              className={cn(
                "rounded-xl border p-4 transition-colors",
                !isBroken
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-red-200 bg-red-50/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{!isBroken ? "✅" : "⚠️"}</span>
                <span className="font-mono text-2xs uppercase tracking-wide font-bold text-ink">
                  {!isBroken ? "Resilience Strategy Applied" : "Active System Vulnerability"}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                {!isBroken ? incident.fixExplanation : "Under production load without circuit breakers or concurrency locks, the system enters cascade failure where downstream saturation blocks upstream web workers."}
              </p>
              {!isBroken && (
                <div className="mt-2.5 rounded border border-emerald-300 bg-white px-2.5 py-1 font-mono text-2xs text-emerald-800">
                  Active Pattern: <strong>{incident.fixName}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Dashboard Gauges (5 cols) */}
          <div className="space-y-3 rounded-xl border border-line bg-zinc-900 p-4 text-white shadow-md lg:col-span-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isBroken ? "bg-red-500 animate-ping" : "bg-emerald-400"
                  )}
                  aria-hidden
                />
                <span className="font-mono text-2xs uppercase tracking-wider text-zinc-300">
                  Live Telemetry Monitor
                </span>
              </div>
              <span className="font-mono text-2xs text-zinc-400">1s interval</span>
            </div>

            {/* Gauge 1: P99 Latency */}
            <div className="rounded-lg bg-zinc-800/80 p-3">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span>P99 End-to-End Latency</span>
                <span className="font-mono text-zinc-300">Target &lt; 50ms</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  className={cn(
                    "font-mono text-2xl font-bold",
                    isBroken ? "text-red-400" : "text-emerald-400"
                  )}
                >
                  {metrics.latency}
                </span>
                <span className="font-mono text-2xs text-zinc-400">{isBroken ? "▲ 2800%" : "▼ 98% (Recovered)"}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    isBroken ? "bg-red-500 w-[95%]" : "bg-emerald-500 w-[12%]"
                  )}
                />
              </div>
            </div>

            {/* Gauge 2: Error Rate */}
            <div className="rounded-lg bg-zinc-800/80 p-3">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span>HTTP 5xx / Failed Requests</span>
                <span className="font-mono text-zinc-300">SLO &lt; 0.05%</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  className={cn(
                    "font-mono text-2xl font-bold",
                    isBroken ? "text-red-400" : "text-emerald-400"
                  )}
                >
                  {metrics.errorRate}
                </span>
                <span className="font-mono text-2xs text-zinc-400">{isBroken ? "SLO VIOLATED" : "HEALTHY"}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    isBroken ? "bg-red-500 w-[70%]" : "bg-emerald-500 w-[1%]"
                  )}
                />
              </div>
            </div>

            {/* Gauge 3: Resource CPU Load */}
            <div className="rounded-lg bg-zinc-800/80 p-3">
              <div className="flex items-center justify-between text-2xs text-zinc-400">
                <span>Database / Worker Fleet CPU</span>
                <span className="font-mono text-zinc-300">Max 70%</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  className={cn(
                    "font-mono text-2xl font-bold",
                    isBroken ? "text-red-400" : "text-emerald-400"
                  )}
                >
                  {metrics.cpu}
                </span>
                <span className="font-mono text-2xs text-zinc-400">{isBroken ? "SATURATION RISK" : "NOMINAL"}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    isBroken ? "bg-red-500 w-[99%]" : "bg-emerald-500 w-[24%]"
                  )}
                />
              </div>
            </div>

            <div className="pt-1 text-center font-mono text-2xs text-zinc-400">
              Interactive Incident Lab in Track 6: Reliability Engineering
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
