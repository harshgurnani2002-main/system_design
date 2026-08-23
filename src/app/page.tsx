"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DiagramFrame } from "@/components/diagram/DiagramFrame";
import { RequestFlowPlayer } from "@/components/diagram/RequestFlowPlayer";
import type { Graph } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Hero architecture — full-width interactive topology                */
/* ------------------------------------------------------------------ */

const HERO_GRAPH: Graph = {
  nodes: [
    { id: "browser", label: "Browser", kind: "client", x: 20, y: 150 },
    { id: "dns", label: "DNS", kind: "infra", x: 210, y: 15 },
    { id: "cdn", label: "CDN Edge", kind: "cache", x: 210, y: 285 },
    { id: "lb", label: "Load Balancer", kind: "app", x: 410, y: 150 },
    { id: "api", label: "API Services", sub: "stateless ×N", kind: "app", x: 620, y: 150 },
    { id: "redis", label: "Redis", sub: "~1ms reads", kind: "cache", x: 830, y: 15 },
    { id: "pg", label: "PostgreSQL", sub: "source of truth", kind: "data", x: 830, y: 285 },
    { id: "queue", label: "Event Queue", sub: "async jobs", kind: "queue", x: 1040, y: 60 },
    { id: "workers", label: "Workers", sub: "emails · media", kind: "app", x: 1040, y: 245 },
  ],
  edges: [
    { from: "browser", to: "dns", label: "resolve", dashed: true },
    { from: "browser", to: "cdn", label: "assets", flow: true },
    { from: "browser", to: "lb", label: "HTTPS GET /api/*", flow: true },
    { from: "cdn", to: "lb", label: "miss → origin", dashed: true },
    { from: "lb", to: "api", label: "route", flow: true },
    { from: "api", to: "redis", label: "hot reads", flow: true },
    { from: "api", to: "pg", label: "writes · misses" },
    { from: "api", to: "queue", label: "emit events", flow: true },
    { from: "queue", to: "workers", flow: true },
  ],
  flows: [
    { id: "hero-assets", path: ["browser", "cdn"], color: "#16A34A", speed: 360 },
    { id: "hero-api", path: ["browser", "lb", "api", "redis"], color: "#2563EB", speed: 300 },
    { id: "hero-db", path: ["api", "pg"], color: "#7C3AED", speed: 220 },
    { id: "hero-jobs", path: ["api", "queue", "workers"], color: "#EA580C", speed: 260 },
  ],
};

const TRACE_STEPS = [
  {
    title: "Browser → DNS",
    detail:
      "Before any connection, the resolver turns yourdomain.com into an IP address — almost always served from cache in single-digit milliseconds.",
    edge: ["browser", "dns"] as [string, string],
  },
  {
    title: "Browser → CDN edge",
    detail:
      "Images, scripts and styles load from a point-of-presence physically near the user. The origin never hears about these requests.",
    edge: ["browser", "cdn"] as [string, string],
    tag: "CACHE HIT",
  },
  {
    title: "CDN → Load balancer",
    detail:
      "Anything dynamic (or a cache miss) travels to origin, where the load balancer owns routing decisions.",
    edge: ["cdn", "lb"] as [string, string],
    tag: "ON MISS",
  },
  {
    title: "Load balancer → API",
    detail:
      "Health-checked, least-connections routing sends the request to one healthy replica among N identical stateless servers.",
    edge: ["lb", "api"] as [string, string],
  },
  {
    title: "API → Redis",
    detail:
      "Hot reads — sessions, profiles, feed pages — come back from memory in about a millisecond. A 95% hit rate lives here.",
    edge: ["api", "redis"] as [string, string],
    tag: "~1ms",
  },
  {
    title: "API → PostgreSQL (the 5% misses)",
    detail:
      "Cache misses and every write land on the source of truth. Durable, transactional, and deliberately kept OFF the hot read path.",
    edge: ["api", "pg"] as [string, string],
    tag: "MISS / WRITE",
  },
  {
    title: "API → Event queue",
    detail:
      "Slow work (emails, image processing, analytics) leaves the request path as an event. The user's response returns immediately.",
    edge: ["api", "queue"] as [string, string],
  },
  {
    title: "Queue → Workers",
    detail:
      "Worker fleets consume events independently — they can crash, restart and catch up without anyone noticing a thing.",
    edge: ["queue", "workers"] as [string, string],
  },
];

function HeroDiagram() {
  const [mode, setMode] = useState<"live" | "trace">("live");

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-node">
      {/* window chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-zinc-50/70 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          </div>
          <span className="font-mono text-2xs text-ink-faint">production-topology.svg</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMode(mode === "live" ? "trace" : "live")}
            aria-pressed={mode === "trace"}
            className={
              mode === "live"
                ? "rounded-md border border-accent-border bg-accent-soft px-2.5 py-1 font-mono text-2xs font-medium text-accent-ink transition-colors hover:bg-blue-100"
                : "rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-2xs text-ink-mute transition-colors hover:border-accent hover:text-accent"
            }
          >
            {mode === "live" ? "▶ run request" : "← back to live"}
          </button>
        </div>
      </div>

      {mode === "live" ? (
        <DiagramFrame graph={HERO_GRAPH} height={380} title={undefined} />
      ) : (
        <RequestFlowPlayer graph={HERO_GRAPH} steps={TRACE_STEPS} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing page                                                       */
/* ------------------------------------------------------------------ */

const PILLARS = [
  {
    n: "01",
    title: "See it",
    body: "Every concept ships as an interactive architecture diagram — click components, trace requests, watch traffic flow through load balancers, caches and queues.",
    href: "/academy/simulator",
    cta: "Open the simulator",
  },
  {
    n: "02",
    title: "Build it",
    body: "A drag-and-drop architecture canvas with an engineering mentor built in: it flags single points of failure, connection exhaustion and Redis-as-a-database before production does.",
    href: "/academy/builder",
    cta: "Launch the builder",
  },
  {
    n: "03",
    title: "Break it",
    body: "Overload databases until they cascade. Kill Redis mid-storm. Watch retry amplification melt a fleet — then learn the patterns that survive: backoff, breakers, batching, bulkheads.",
    href: "/academy/failures",
    cta: "Break a system",
  },
];

const TRACK_PREVIEWS = [
  {
    name: "Engineering Foundations",
    desc: "DNS → TCP → TLS → HTTP/3. The request lifecycle, latency numbers, and protocol tradeoffs.",
    chapters: "2 chapters",
    href: "/academy/learn/foundations",
  },
  {
    name: "Core System Design",
    desc: "Capacity math, load balancers, caching, rate limiting, Redis — the blocks every system reuses.",
    chapters: "5 chapters",
    href: "/academy/learn/core-design",
  },
  {
    name: "Data Systems & Distribution",
    desc: "Postgres internals & scaling, Kafka delivery semantics, CAP/PACELC, quorums, Raft consensus.",
    chapters: "3 chapters",
    href: "/academy/learn/data-systems",
  },
  {
    name: "Production Infrastructure",
    desc: "Docker, Kubernetes, Git workflows, CI/CD pipelines and observability — ship what you design.",
    chapters: "5 chapters",
    href: "/academy/learn/infrastructure",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            System Design<span className="text-accent"> Academy</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-ink-mute md:flex">
            <a href="#philosophy" className="hover:text-ink">Philosophy</a>
            <a href="#curriculum" className="hover:text-ink">Curriculum</a>
            <Link href="/academy/case-studies" className="hover:text-ink">Real-World Systems</Link>
            <Link href="/academy/reference" className="hover:text-ink">Reference</Link>
          </nav>
          <Link
            href="/academy"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Start Learning
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 md:px-6 md:pt-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-2xs text-ink-mute">
            <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-ok" />
            Interactive · Not another video course
          </p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-ink md:text-[3.4rem]">
            Learn System Design by{" "}
            <span className="relative inline-block text-accent">
              building real systems.
              <svg viewBox="0 0 220 8" className="absolute -bottom-1 left-0 w-full" preserveAspectRatio="none" aria-hidden>
                <path d="M2 6 Q 60 1, 110 4 T 218 3" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
              </svg>
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-mute">
            From your first API to globally distributed infrastructure. Every lesson is a live system you can overload,
            break, debug and redesign — not a wall of text.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/academy"
              className="inline-flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-medium text-white shadow-[0_1px_3px_rgba(37,99,235,0.4)] transition-colors hover:bg-accent-hover"
            >
              Start Learning
            </Link>
            <Link
              href="/academy/builder"
              className="inline-flex h-11 items-center rounded-lg border border-line-strong bg-surface px-5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Explore Architecture
            </Link>
          </div>
        </div>

        {/* full-width live architecture — the hero IS the product demo */}
        <div className="mt-12">
          <HeroDiagram />
          <p className="mt-2.5 text-center font-mono text-2xs leading-relaxed text-ink-faint">
            hover any component for its purpose · click for the full “why” · ▶ run request walks the path step by step
          </p>
        </div>

        <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
          {[
            ["18", "deep chapters"],
            ["20", "case studies"],
            ["38", "engineering concepts"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="font-mono text-xl font-semibold text-ink">{v}</dd>
              <dd className="text-2xs leading-tight text-ink-faint">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* philosophy strip */}
      <section id="philosophy" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">The method</p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Don&apos;t just explain system design. Let the learner see it, build it, break it.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.n} className="bg-surface p-6 transition-colors hover:bg-zinc-50">
                <span className="font-mono text-2xs text-ink-faint">{p.n}</span>
                <h3 className="mt-2 text-lg font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 min-h-[96px] text-[13px] leading-relaxed text-ink-mute">{p.body}</p>
                <Link href={p.href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-hover">
                  {p.cta}
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* curriculum */}
      <section id="curriculum" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">Curriculum</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
              Fundamentals to production-grade distributed systems
            </h2>
          </div>
          <Link href="/academy" className="text-sm font-medium text-accent hover:text-accent-hover">
            Full curriculum →
          </Link>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {TRACK_PREVIEWS.map((t) => (
            <Link
              key={t.name}
              href={t.href}
              className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent-border hover:bg-accent-soft/30"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-ink group-hover:text-accent-ink">{t.name}</h3>
                <span className="font-mono text-2xs text-ink-faint">{t.chapters}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{t.desc}</p>
            </Link>
          ))}
        </div>

        {/* signature experience callout */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-ink text-white">
          <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-blue-300">Signature experience</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">&ldquo;How does Instagram handle 1 million likes?&rdquo;</h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-300">
                Start with one Postgres row. Push traffic until it burns. Add a cache and watch the bottleneck move.
                Trigger a like storm and meet the hot-key problem. Fix it with async aggregation and sharded counters —
                every step measured, every tradeoff visible.
              </p>
              <ul className="mt-5 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-zinc-300">
                {["Live QPS simulation", "Hot-key visualization", "Async counter pipeline", "Capacity calculators"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-blue-400" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-end">
              <Link
                href="/academy/learn/core-design/caching"
                className="inline-flex h-11 shrink-0 items-center rounded-lg bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-blue-50"
              >
                Run the lesson →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 md:px-6">
          <div className="flex items-center gap-6 text-sm text-ink-mute">
            <Link href="/" className="font-medium text-ink">System Design Academy</Link>
            <Link href="/academy/glossary" className="hover:text-ink">Glossary</Link>
            <Link href="/academy/interview" className="hover:text-ink">Interview Prep</Link>
          </div>
          <p className="font-mono text-2xs text-ink-faint">
            See it · Build it · Break it · Debug it · Deploy it
          </p>
        </div>
      </footer>
    </div>
  );
}
