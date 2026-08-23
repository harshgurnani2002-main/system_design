"use client";

import { useState } from "react";
import Link from "next/link";
import { DiagramFrame } from "@/components/diagram/DiagramFrame";
import { RequestFlowPlayer } from "@/components/diagram/RequestFlowPlayer";
import type { Graph } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Hero architecture graph — clean, elegant, balanced topology       */
/* ------------------------------------------------------------------ */

const HERO_GRAPH: Graph = {
  nodes: [
    { id: "browser", label: "Browser / App", sub: "HTTPS Client", kind: "client", x: 20, y: 150 },
    { id: "dns", label: "Anycast DNS", sub: "Geo-routed ~5ms", kind: "infra", x: 210, y: 20 },
    { id: "cdn", label: "Edge CDN", sub: "Cloudflare PoP", kind: "cache", x: 210, y: 280 },
    { id: "lb", label: "Load Balancer", sub: "TLS · Rate Limiter", kind: "app", x: 410, y: 150 },
    { id: "api", label: "API Services", sub: "Stateless Cluster", kind: "app", x: 620, y: 150 },
    { id: "redis", label: "Redis Cache", sub: "~0.8ms hot reads", kind: "cache", x: 830, y: 20 },
    { id: "pg", label: "PostgreSQL", sub: "ACID · Source of truth", kind: "data", x: 830, y: 280 },
    { id: "queue", label: "Event Queue", sub: "Kafka / SQS", kind: "queue", x: 1040, y: 70 },
    { id: "workers", label: "Async Workers", sub: "Batch processing", kind: "app", x: 1040, y: 240 },
  ],
  edges: [
    { from: "browser", to: "dns", label: "resolve", dashed: true },
    { from: "browser", to: "cdn", label: "assets (95% hit)", flow: true },
    { from: "browser", to: "lb", label: "HTTPS /api/*", flow: true },
    { from: "cdn", to: "lb", label: "miss → origin", dashed: true },
    { from: "lb", to: "api", label: "route", flow: true },
    { from: "api", to: "redis", label: "hot reads", flow: true },
    { from: "api", to: "pg", label: "writes · misses" },
    { from: "api", to: "queue", label: "emit event", flow: true },
    { from: "queue", to: "workers", label: "consume", flow: true },
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
    title: "1. Browser → Anycast DNS",
    detail: "The client resolves the domain via Anycast DNS in single-digit milliseconds before establishing any TCP socket.",
    edge: ["browser", "dns"] as [string, string],
    tag: "~5ms",
  },
  {
    title: "2. Browser → Edge CDN",
    detail: "Static assets and cached responses load from the nearest edge point-of-presence, absorbing over 90% of global request volume.",
    edge: ["browser", "cdn"] as [string, string],
    tag: "CACHE HIT",
  },
  {
    title: "3. Browser → Load Balancer",
    detail: "Dynamic requests route to origin. The load balancer terminates TLS, enforces token-bucket rate limits, and routes to healthy backends.",
    edge: ["browser", "lb"] as [string, string],
    tag: "TLS + WAF",
  },
  {
    title: "4. Load Balancer → Stateless API Fleet",
    detail: "Least-connections algorithm dispatches traffic across N identical stateless microservice pods with automatic health checks.",
    edge: ["lb", "api"] as [string, string],
  },
  {
    title: "5. API → Redis In-Memory Cache",
    detail: "Hot reads (sessions, user metadata, recent posts) return in ~0.8ms. A 90%+ hit rate keeps load off the database tier.",
    edge: ["api", "redis"] as [string, string],
    tag: "~0.8ms READ",
  },
  {
    title: "6. API → PostgreSQL Primary",
    detail: "Transactional mutations and cache misses land on durable storage with WAL streaming replication to read replicas.",
    edge: ["api", "pg"] as [string, string],
    tag: "ACID WRITE",
  },
  {
    title: "7. API → Event Queue & Async Workers",
    detail: "Slow side-effects (transcoding, notifications, indexing) leave the request path as events, keeping user latency under 50ms.",
    edge: ["api", "queue"] as [string, string],
    tag: "ASYNC",
  },
  {
    title: "8. Queue → Worker Fleet",
    detail: "Workers consume event partitions in parallel. Fleets scale independently and can restart without dropping customer requests.",
    edge: ["queue", "workers"] as [string, string],
  },
];

const PILLARS = [
  {
    icon: "👁️",
    title: "See it",
    tagline: "Live Interactive Topologies",
    body: "Every concept ships as a live diagram. Watch packets flow through load balancers, inspect cache hits, and step through request lifecycles hop by hop.",
    href: "/academy/simulator",
    cta: "Explore simulator",
  },
  {
    icon: "📐",
    title: "Build it",
    tagline: "Drag-and-Drop Canvas + Linter",
    body: "Design architectures with a built-in engineering mentor that flags single points of failure, missing caches, and unbuffered write bottlenecks in real time.",
    href: "/academy/builder",
    cta: "Launch canvas builder",
  },
  {
    icon: "💥",
    title: "Break it",
    tagline: "Live Incident & Chaos Drills",
    body: "Simulate cache stampedes, cascading retry storms, and Kafka consumer lag. Learn the resilience patterns that survive: circuit breakers, jitter, and bulkheads.",
    href: "/academy/failures",
    cta: "Break a system",
  },
];

const FEATURED_CASE_STUDIES = [
  {
    slug: "instagram",
    name: "Instagram Architecture V1→V10",
    scale: "500M DAU · 100M Uploads/day",
    desc: "From 1 server on Python to 10 versions — object storage, sharded Redis counters, async fanout, and global edge caching.",
    tag: "Evolution Player",
    diff: "Standard",
  },
  {
    slug: "whatsapp",
    name: "WhatsApp 2B User Scaling",
    scale: "2 Billion Users · 100B Msgs/day",
    desc: "Handling 2M concurrent TCP connections per box using Erlang BEAM, epoll sockets, and offline queue storage.",
    tag: "High Concurrency",
    diff: "Hard",
  },
  {
    slug: "uber",
    name: "Uber Geospatial Dispatch",
    scale: "30M Trips/day · 5M Drivers",
    desc: "Geospatial indexing with Uber H3 hexagonal cells, dynamic pricing algorithms, and distributed saga state machines.",
    tag: "Geospatial Systems",
    diff: "Hard",
  },
  {
    slug: "netflix",
    name: "Netflix Video Streaming CDN",
    scale: "230M Subscribers · 15% Global Web",
    desc: "Custom Open Connect edge appliances, video chunk transcoding pipelines, and multi-region active-active failover.",
    tag: "Edge CDN & Chaos",
    diff: "Hard",
  },
];

const CURRICULUM_PHASES = [
  {
    phase: "Phase 1",
    title: "Foundations & Protocols",
    level: "Level 0",
    topics: "DNS Anycast, TCP 3-Way Handshake, TLS 1.3, HTTP/2 vs HTTP/3, Protobuf",
    href: "/academy/learn/foundations",
  },
  {
    phase: "Phase 2",
    title: "Core Design & Caching",
    level: "Levels 1–2",
    topics: "Capacity Fermi Math, Load Balancers, Redis Caching, Token Bucket Rate Limiters",
    href: "/academy/learn/core-design",
  },
  {
    phase: "Phase 3",
    title: "Data Systems & Streaming",
    level: "Level 3",
    topics: "PostgreSQL B-Tree & WAL, Kafka Partitioning, Transactional Outbox Pattern",
    href: "/academy/learn/data-systems",
  },
  {
    phase: "Phase 4",
    title: "Distributed & Reliability",
    level: "Levels 4–5 · Production",
    topics: "CAP/PACELC, Raft Consensus, Circuit Breakers, Exponential Backoff with Jitter",
    href: "/academy/learn/distributed",
  },
];

export default function LandingPage() {
  const [heroMode, setHeroMode] = useState<"live" | "trace">("live");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-accent-soft selection:text-accent-ink">
      {/* Skip to Main Content (Accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-ink transition-opacity hover:opacity-85 focus-visible:outline-accent"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white font-mono text-xs font-black">
              SD
            </span>
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              System Design <span className="text-accent">Academy</span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-6 text-xs font-medium text-ink-mute md:flex">
            <Link href="/academy" className="transition-colors hover:text-ink">
              Curriculum
            </Link>
            <Link href="/academy/builder" className="transition-colors hover:text-ink">
              Canvas Builder
            </Link>
            <Link href="/academy/simulator" className="transition-colors hover:text-ink">
              Simulator
            </Link>
            <Link href="/academy/case-studies" className="transition-colors hover:text-ink">
              Case Studies
            </Link>
            <Link href="/academy/failures" className="transition-colors hover:text-ink">
              Chaos Drills
            </Link>
            <Link href="/academy/reference" className="transition-colors hover:text-ink">
              Reference
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/academy"
              className="inline-flex h-8 items-center rounded-lg bg-ink px-3.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-zinc-800 focus-visible:outline-accent"
            >
              Start Learning →
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle Navigation Menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line md:hidden hover:bg-zinc-100"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                ) : (
                  <path
                    fillRule="evenodd"
                    d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-line bg-surface px-4 py-3 text-xs font-medium md:hidden">
            <nav className="flex flex-col space-y-2">
              <Link href="/academy" onClick={() => setMobileMenuOpen(false)} className="py-1 text-ink hover:text-accent">
                📚 Full Curriculum
              </Link>
              <Link href="/academy/builder" onClick={() => setMobileMenuOpen(false)} className="py-1 text-ink hover:text-accent">
                📐 Architecture Canvas Builder
              </Link>
              <Link href="/academy/simulator" onClick={() => setMobileMenuOpen(false)} className="py-1 text-ink hover:text-accent">
                ⚡ Traffic Flow Simulator
              </Link>
              <Link href="/academy/case-studies" onClick={() => setMobileMenuOpen(false)} className="py-1 text-ink hover:text-accent">
                🏛️ 20 Real-World Case Studies
              </Link>
              <Link href="/academy/failures" onClick={() => setMobileMenuOpen(false)} className="py-1 text-ink hover:text-accent">
                💥 Chaos &amp; Failure Drills
              </Link>
              <Link href="/academy/reference" onClick={() => setMobileMenuOpen(false)} className="py-1 text-ink hover:text-accent">
                📊 Latency Numbers &amp; Reference
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content">
        {/* ========================================================== */}
        {/*  HERO SECTION                                              */}
        {/* ========================================================== */}
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
          <div className="max-w-3xl">
            {/* Top pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" aria-hidden="true" />
              <span className="font-mono text-2xs text-ink-mute">
                Interactive Learning · 0% Video Fluff
              </span>
            </div>

            {/* Headline */}
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl leading-[1.12]">
              Learn System Design by{" "}
              <span className="text-accent underline decoration-accent/30 decoration-wavy underline-offset-4">
                building real systems.
              </span>
            </h1>

            {/* Subhead */}
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-ink-soft max-w-2xl">
              From your first API to globally distributed infrastructure. Every concept is an interactive,
              runnable architecture you can overload, break, debug, and redesign in your browser.
            </p>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/academy"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-accent"
              >
                Start Free Curriculum →
              </Link>
              <Link
                href="/academy/builder"
                className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-xs font-semibold text-ink shadow-xs transition-colors hover:border-accent hover:text-accent focus-visible:outline-accent"
              >
                📐 Open Architecture Canvas
              </Link>
              <Link
                href="/academy/failures"
                className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-xs font-medium text-ink-mute hover:text-ink focus-visible:outline-accent"
              >
                💥 Chaos Drills
              </Link>
            </div>
          </div>

          {/* Hero Architecture Frame */}
          <div className="mt-10">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
              {/* Window chrome header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-zinc-50/80 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                  </div>
                  <span className="font-mono text-2xs font-medium text-ink-mute">
                    production-microservices-topology.svg
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHeroMode(heroMode === "live" ? "trace" : "live")}
                    aria-pressed={heroMode === "trace"}
                    className={cn(
                      "rounded-md border px-2.5 py-1 font-mono text-2xs font-medium transition-colors focus-visible:outline-accent",
                      heroMode === "live"
                        ? "border-accent-border bg-accent-soft text-accent-ink hover:bg-blue-100"
                        : "border-line bg-surface text-ink-mute hover:border-accent hover:text-accent"
                    )}
                  >
                    {heroMode === "live" ? "▶ Trace Request Hop-by-Hop" : "← Back to Live Traffic"}
                  </button>
                </div>
              </div>

              {/* Interactive diagram canvas */}
              {heroMode === "live" ? (
                <DiagramFrame graph={HERO_GRAPH} height={360} title={undefined} />
              ) : (
                <RequestFlowPlayer graph={HERO_GRAPH} steps={TRACE_STEPS} />
              )}
            </div>

            <p className="mt-2.5 text-center font-mono text-2xs text-ink-faint">
              Click any node on canvas for engineering rationale &amp; failure impacts · Switch to Step-by-Step mode for hop-by-hop latency breakdowns
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <dl className="mt-10 grid grid-cols-2 gap-4 border-t border-line pt-6 sm:grid-cols-4">
            <div>
              <dt className="text-2xs font-mono uppercase text-ink-faint">Curriculum</dt>
              <dd className="mt-0.5 font-mono text-xl font-bold text-ink">18 Chapters</dd>
              <dd className="text-2xs text-ink-mute">Interactive lessons</dd>
            </div>
            <div>
              <dt className="text-2xs font-mono uppercase text-ink-faint">Real-World</dt>
              <dd className="mt-0.5 font-mono text-xl font-bold text-accent">20 Case Studies</dd>
              <dd className="text-2xs text-ink-mute">Instagram, Uber, Netflix, WhatsApp</dd>
            </div>
            <div>
              <dt className="text-2xs font-mono uppercase text-ink-faint">Hands-on</dt>
              <dd className="mt-0.5 font-mono text-xl font-bold text-emerald-600">13 Labs</dd>
              <dd className="text-2xs text-ink-mute">Built-in architecture linter</dd>
            </div>
            <div>
              <dt className="text-2xs font-mono uppercase text-ink-faint">Resilience</dt>
              <dd className="mt-0.5 font-mono text-xl font-bold text-red-600">12 Chaos Drills</dd>
              <dd className="text-2xs text-ink-mute">Production incident triage</dd>
            </div>
          </dl>
        </section>

        {/* ========================================================== */}
        {/*  THE THREE PILLARS                                         */}
        {/* ========================================================== */}
        <section id="philosophy" className="border-y border-line bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
                The Method
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Don&apos;t just read about system design. See it, build it, break it.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="flex flex-col justify-between rounded-xl border border-line bg-paper p-6 transition-all hover:border-accent-border hover:bg-surface hover:shadow-sm"
                >
                  <div>
                    <div className="text-2xl" aria-hidden="true">{p.icon}</div>
                    <div className="mt-3 font-mono text-2xs font-semibold uppercase text-accent-ink">
                      {p.tagline}
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-ink">{p.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink-soft">{p.body}</p>
                  </div>
                  <Link
                    href={p.href}
                    className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
                  >
                    <span>{p.cta}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================== */}
        {/*  FEATURED CASE STUDIES (CURATED 4 CARDS)                   */}
        {/* ========================================================== */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
                Real-World Architecture
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Twenty Systems, Fully Reconstructed
              </h2>
              <p className="mt-1.5 text-xs text-ink-mute max-w-xl">
                Complete engineering reconstructions with capacity math, live traffic flows, failure labs, and scaling ladders.
              </p>
            </div>
            <Link
              href="/academy/case-studies"
              className="text-xs font-semibold text-accent hover:text-accent-hover"
            >
              View all 20 case studies →
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED_CASE_STUDIES.map((cs) => (
              <Link
                key={cs.slug}
                href={`/academy/case-studies/system/${cs.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4.5 transition-all hover:border-accent-border hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-2xs font-medium text-accent-ink">
                      {cs.tag}
                    </span>
                    <span className="font-mono text-2xs text-ink-faint">{cs.diff}</span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold text-ink group-hover:text-accent transition-colors">
                    {cs.name}
                  </h3>
                  <div className="mt-0.5 font-mono text-2xs text-ink-faint">
                    ⚡ {cs.scale}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft line-clamp-3">
                    {cs.desc}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-line/60 flex items-center justify-between text-2xs font-semibold text-accent group-hover:text-accent-hover">
                  <span>Explore Case Study</span>
                  <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ========================================================== */}
        {/*  STRUCTURED LEARNING ROADMAP (4 PHASES)                    */}
        {/* ========================================================== */}
        <section className="border-t border-line bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
                  Curriculum Roadmap
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  From Request Lifecycle to Distributed Consensus
                </h2>
              </div>
              <Link href="/academy" className="text-xs font-semibold text-accent hover:text-accent-hover">
                Full 8-track syllabus →
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CURRICULUM_PHASES.map((p) => (
                <Link
                  key={p.phase}
                  href={p.href}
                  className="group rounded-xl border border-line bg-paper p-4 transition-all hover:border-accent-border hover:bg-surface hover:shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xs font-semibold uppercase text-accent-ink">
                      {p.phase}
                    </span>
                    <span className="rounded border border-line bg-zinc-50 px-1.5 py-0.2 font-mono text-2xs text-ink-mute">
                      {p.level}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-ink group-hover:text-accent transition-colors">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">
                    {p.topics}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================== */}
        {/*  SIGNATURE EXPERIENCE TEASER                               */}
        {/* ========================================================== */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-line bg-ink text-white p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div className="space-y-2">
                <span className="font-mono text-2xs uppercase tracking-widest text-blue-300 font-semibold">
                  Signature Interactive Lesson
                </span>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-white">
                  &ldquo;How does Instagram handle 1 million likes per second?&rdquo;
                </h2>
                <p className="max-w-2xl text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Start with a single PostgreSQL row. Push traffic until row-level locks crash the connection pool.
                  Add Redis to meet the single hot-key bottleneck. Fix it with sharded counter buckets and async Kafka compaction.
                </p>
              </div>
              <div>
                <Link
                  href="/academy/learn/core-design/caching"
                  className="inline-flex h-10 items-center rounded-lg bg-white px-5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-blue-50"
                >
                  Run the simulation →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================== */}
        {/*  CLEAN CALL TO ACTION                                      */}
        {/* ========================================================== */}
        <section className="border-t border-line bg-surface py-16 text-center">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Ready to design systems that don&apos;t fail under load?
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-ink-soft leading-relaxed">
              Join engineers mastering distributed architectures through live interactive simulations, canvas linters, and chaos failure drills.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/academy"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-6 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-accent"
              >
                Start Learning for Free →
              </Link>
              <Link
                href="/academy/builder"
                className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-5 text-xs font-semibold text-ink transition-colors hover:border-line-strong hover:bg-zinc-50 focus-visible:outline-accent"
              >
                Try Architecture Canvas
              </Link>
            </div>
            <p className="mt-4 font-mono text-2xs text-ink-faint">
              Instant access · No login required to start exploring
            </p>
          </div>
        </section>
      </main>

      {/* ========================================================== */}
      {/*  ACCESSIBLE COMPACT FOOTER                                 */}
      {/* ========================================================== */}
      <footer role="contentinfo" className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-5 text-xs text-ink-mute">
            <Link href="/" className="font-semibold text-ink">
              System Design Academy
            </Link>
            <Link href="/academy" className="hover:text-ink">
              Curriculum
            </Link>
            <Link href="/academy/builder" className="hover:text-ink">
              Canvas Builder
            </Link>
            <Link href="/academy/case-studies" className="hover:text-ink">
              Case Studies
            </Link>
            <Link href="/academy/failures" className="hover:text-ink">
              Chaos Drills
            </Link>
            <Link href="/academy/reference" className="hover:text-ink">
              Reference
            </Link>
            <Link href="/academy/glossary" className="hover:text-ink">
              Glossary
            </Link>
          </div>
          <p className="font-mono text-2xs text-ink-faint">
            See it · Build it · Break it · Deploy it
          </p>
        </div>
      </footer>
    </div>
  );
}
