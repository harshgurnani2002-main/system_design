"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FeaturedCase {
  slug: string;
  name: string;
  category: "Social & Media" | "Real-Time & Streams" | "FinTech & E-Commerce" | "High-Scale Infra";
  difficulty: "Warm-up" | "Standard" | "Hard" | "Expert";
  scale: string;
  tagline: string;
  keyConcepts: string[];
  minutes: number;
  failureCount: number;
}

const FEATURED_CASES: FeaturedCase[] = [
  {
    slug: "instagram",
    name: "Instagram",
    category: "Social & Media",
    difficulty: "Standard",
    scale: "500M DAU · 100M uploads/day",
    tagline: "Evolution from 1 server to 10 versions — object storage, sharded Redis counters, async fanout and CDN edge caching.",
    keyConcepts: ["V1→V10 Evolution", "Sharded Counters", "Async Fanout", "CDN Offloading"],
    minutes: 35,
    failureCount: 4,
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    category: "Real-Time & Streams",
    difficulty: "Hard",
    scale: "2 Billion users · 100B msgs/day",
    tagline: "Handling 2M persistent TCP connections per box using Erlang BEAM, epoll sockets, and offline queue storage.",
    keyConcepts: ["Erlang BEAM", "2M TCP Conns/Box", "End-to-End Encryption", "Offline Queues"],
    minutes: 40,
    failureCount: 5,
  },
  {
    slug: "uber",
    name: "Uber / Ride Dispatch",
    category: "Real-Time & Streams",
    difficulty: "Hard",
    scale: "30M rides/day · 5M drivers",
    tagline: "Geospatial indexing with Uber H3 hexagonal cells, dynamic pricing algorithms, and distributed saga state machines.",
    keyConcepts: ["H3 Spatial Hexagons", "Dynamic Surge Pricing", "Saga State Machine", "Bipartite Match"],
    minutes: 45,
    failureCount: 6,
  },
  {
    slug: "netflix",
    name: "Netflix Video Streaming",
    category: "High-Scale Infra",
    difficulty: "Hard",
    scale: "230M subscribers · 15% global internet traffic",
    tagline: "Open Connect custom CDN appliances, video transcoding chunk pipelines, and multi-region active-active failover.",
    keyConcepts: ["Open Connect CDN", "Video Chunk Encoding", "Active-Active Multi-Region", "Chaos Monkey"],
    minutes: 45,
    failureCount: 5,
  },
  {
    slug: "stripe",
    name: "Stripe Payment Processing",
    category: "FinTech & E-Commerce",
    difficulty: "Expert",
    scale: "$1 Trillion volume · 99.999% SLA",
    tagline: "Zero double-charge guarantee via idempotency keys, distributed 2PC / Sagas, and immutable ledger accounting.",
    keyConcepts: ["Idempotency Keys", "Double-Entry Ledger", "Distributed Locks", "Atomic Settlement"],
    minutes: 50,
    failureCount: 6,
  },
  {
    slug: "twitter",
    name: "Twitter / X Timeline",
    category: "Social & Media",
    difficulty: "Standard",
    scale: "250M DAU · 500M tweets/day",
    tagline: "Hybrid fan-out architecture: Fan-out on write for standard users, fan-out on read for high-follower celebrities.",
    keyConcepts: ["Hybrid Fanout", "Celebrity Problem", "Timeline Cache", "Snowflake ID"],
    minutes: 35,
    failureCount: 4,
  },
];

const CATEGORIES = ["All", "Social & Media", "Real-Time & Streams", "FinTech & E-Commerce", "High-Scale Infra"] as const;

export function CaseStudiesShowcase() {
  const [selectedCat, setSelectedCat] = useState<string>("All");

  const filtered = selectedCat === "All"
    ? FEATURED_CASES
    : FEATURED_CASES.filter((c) => c.category === selectedCat);

  return (
    <section aria-labelledby="case-studies-heading" className="space-y-6">
      {/* Heading & Categories */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
            Real-World Engineering
          </span>
          <h2 id="case-studies-heading" className="mt-1 text-2xl font-bold tracking-tight text-ink md:text-3xl">
            20 Complete Production Reconstructions
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft leading-relaxed">
            Not high-level summaries — full engineering reconstructions with capacity math, API contracts, animated packet lifecycles, and failure labs.
          </p>
        </div>

        <Link
          href="/academy/case-studies"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover"
        >
          View all 20 case studies →
        </Link>
      </div>

      {/* Category Filter Pills */}
      <div
        role="tablist"
        aria-label="Filter case studies by category"
        className="flex flex-wrap gap-1.5 border-b border-line pb-3"
      >
        {CATEGORIES.map((cat) => {
          const isSel = selectedCat === cat;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={isSel}
              onClick={() => setSelectedCat(cat)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-all focus-visible:outline-accent",
                isSel
                  ? "bg-ink text-white font-semibold shadow-xs"
                  : "bg-surface border border-line text-ink-mute hover:border-line-strong hover:text-ink"
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((cs) => (
          <Link
            key={cs.slug}
            href={`/academy/case-studies/system/${cs.slug}`}
            className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 transition-all hover:border-accent-border hover:shadow-pop"
          >
            <div>
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-2xs uppercase text-ink-faint">{cs.category}</span>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-mono text-2xs font-semibold",
                    cs.difficulty === "Warm-up" && "border-ok-border bg-ok-soft text-ok-ink",
                    cs.difficulty === "Standard" && "border-accent-border bg-accent-soft text-accent-ink",
                    cs.difficulty === "Hard" && "border-warn-border bg-warn-soft text-warn-ink",
                    cs.difficulty === "Expert" && "border-danger-border bg-danger-soft text-danger-ink"
                  )}
                >
                  {cs.difficulty}
                </span>
              </div>

              {/* Title & scale */}
              <h3 className="mt-2 text-lg font-bold text-ink group-hover:text-accent transition-colors">
                {cs.name}
              </h3>
              <div className="mt-0.5 font-mono text-2xs font-semibold text-accent-ink">
                ⚡ {cs.scale}
              </div>

              {/* Tagline */}
              <p className="mt-2.5 text-xs text-ink-soft leading-relaxed line-clamp-3">
                {cs.tagline}
              </p>

              {/* Key Concept Chips */}
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {cs.keyConcepts.map((concept) => (
                  <span
                    key={concept}
                    className="rounded bg-zinc-100 px-2 py-0.5 text-2xs font-medium text-ink-soft group-hover:bg-accent-soft group-hover:text-accent-ink transition-colors"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer meta */}
            <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-2xs font-mono text-ink-mute">
              <span>⏱ {cs.minutes} min deep dive</span>
              <span className="flex items-center gap-1 font-semibold text-ink group-hover:text-accent">
                Explore System →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
