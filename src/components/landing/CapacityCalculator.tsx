"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SystemPreset {
  name: string;
  dau: number;
  actions: number;
  rwRatio: number;
  payloadKb: number;
  description: string;
}

const PRESETS: Record<string, SystemPreset> = {
  custom: {
    name: "Custom Parameters",
    dau: 50_000_000,
    actions: 20,
    rwRatio: 10,
    payloadKb: 2,
    description: "Adjust the sliders below to compute real-time capacity and hardware needs.",
  },
  twitter: {
    name: "Twitter / X Post Timeline",
    dau: 250_000_000,
    actions: 30,
    rwRatio: 20,
    payloadKb: 1.5,
    description: "250M DAU with 20:1 read-to-write timeline viewing vs posting tweets.",
  },
  instagram: {
    name: "Instagram Photo & Story Feed",
    dau: 500_000_000,
    actions: 25,
    rwRatio: 15,
    payloadKb: 15,
    description: "High payload media metadata with aggressive 80/20 hot cache caching.",
  },
  uber: {
    name: "Uber Real-Time Location Pings",
    dau: 30_000_000,
    actions: 80,
    rwRatio: 1,
    payloadKb: 0.5,
    description: "Write-heavy stream of GPS telemetry updates every 4 seconds.",
  },
};

export function CapacityCalculator() {
  const [activePreset, setActivePreset] = useState<string>("instagram");
  const [dau, setDau] = useState<number>(500_000_000);
  const [actionsPerUser, setActionsPerUser] = useState<number>(25);
  const [rwRatio, setRwRatio] = useState<number>(15); // e.g. 15:1
  const [payloadKb, setPayloadKb] = useState<number>(15);

  const dauId = useId();
  const actionsId = useId();
  const rwRatioId = useId();
  const payloadId = useId();

  const handlePresetSelect = (key: string) => {
    setActivePreset(key);
    if (key !== "custom") {
      const p = PRESETS[key];
      setDau(p.dau);
      setActionsPerUser(p.actions);
      setRwRatio(p.rwRatio);
      setPayloadKb(p.payloadKb);
    }
  };

  // Capacity Math Formulas (Seconds in a day = 86,400)
  const totalDailyRequests = dau * actionsPerUser;
  const avgQps = Math.round(totalDailyRequests / 86400);
  const peakQps = Math.round(avgQps * 2.5); // 2.5x peak factor

  // Read vs Write QPS
  const writeQps = Math.round(avgQps / (rwRatio + 1));
  const readQps = avgQps - writeQps;
  const peakWriteQps = Math.round(writeQps * 2.5);

  // Bandwidth
  const ingressBytesPerSec = writeQps * payloadKb * 1024;
  const ingressMbps = (ingressBytesPerSec * 8) / (1024 * 1024);
  const egressBytesPerSec = readQps * payloadKb * 1024;
  const egressMbps = (egressBytesPerSec * 8) / (1024 * 1024);

  // Storage
  const dailyWriteBytes = totalDailyRequests * (1 / (rwRatio + 1)) * payloadKb * 1024;
  const dailyStorageGb = dailyWriteBytes / (1024 * 1024 * 1024);
  const dailyStorageTb = dailyStorageGb / 1024;
  const fiveYearStorageTb = dailyStorageTb * 365 * 5 * 3; // 3x replication factor

  // 80/20 Cache RAM rule (20% of daily active working set cached in memory)
  const dailyTotalDataGb = (totalDailyRequests * payloadKb * 1024) / (1024 * 1024 * 1024);
  const cacheRamNeededGb = Math.round(dailyTotalDataGb * 0.2);

  // Hardware estimate (Assuming 1,500 write IOPS per Postgres primary)
  const recommendedShards = Math.max(1, Math.ceil(peakWriteQps / 1500));
  const recommendedRedisNodes = Math.max(2, Math.ceil(cacheRamNeededGb / 64)); // 64GB RAM per node

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      {/* Header Bar */}
      <div className="border-b border-line bg-zinc-50/80 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
                Interactive Engineering Math
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-2xs font-semibold text-emerald-800">
                Live Calculator
              </span>
            </div>
            <h3 className="mt-0.5 text-base font-semibold text-ink sm:text-lg">
              Real-Time Capacity &amp; Hardware Sizing Engine
            </h3>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetSelect(key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-2xs font-medium transition-colors focus-visible:outline-accent",
                  activePreset === key
                    ? "bg-accent text-white font-semibold shadow-xs"
                    : "border border-line bg-surface text-ink-mute hover:border-line-strong hover:text-ink"
                )}
              >
                {key === "custom" ? "Custom" : key.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-12">
        {/* Sliders Input Panel (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <p className="text-xs text-ink-soft">
            {PRESETS[activePreset]?.description || "Tune the system scale parameters below:"}
          </p>

          {/* DAU */}
          <div className="space-y-1.5 rounded-lg border border-line bg-zinc-50/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor={dauId} className="font-medium text-ink">
                Daily Active Users (DAU)
              </label>
              <span className="font-mono font-semibold text-accent">
                {(dau / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M users
              </span>
            </div>
            <input
              id={dauId}
              type="range"
              min={1_000_000}
              max={1_000_000_000}
              step={5_000_000}
              value={dau}
              onChange={(e) => {
                setDau(Number(e.target.value));
                setActivePreset("custom");
              }}
              className="w-full"
              aria-label="Daily Active Users"
            />
            <div className="flex justify-between text-2xs text-ink-faint font-mono">
              <span>1M</span>
              <span>500M</span>
              <span>1B</span>
            </div>
          </div>

          {/* Actions / Day */}
          <div className="space-y-1.5 rounded-lg border border-line bg-zinc-50/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor={actionsId} className="font-medium text-ink">
                Requests / Actions per User / Day
              </label>
              <span className="font-mono font-semibold text-accent">{actionsPerUser} reqs/day</span>
            </div>
            <input
              id={actionsId}
              type="range"
              min={1}
              max={150}
              step={1}
              value={actionsPerUser}
              onChange={(e) => {
                setActionsPerUser(Number(e.target.value));
                setActivePreset("custom");
              }}
              className="w-full"
              aria-label="Actions per user per day"
            />
            <div className="flex justify-between text-2xs text-ink-faint font-mono">
              <span>1</span>
              <span>75</span>
              <span>150</span>
            </div>
          </div>

          {/* Read / Write Ratio */}
          <div className="space-y-1.5 rounded-lg border border-line bg-zinc-50/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor={rwRatioId} className="font-medium text-ink">
                Read : Write Ratio
              </label>
              <span className="font-mono font-semibold text-accent">{rwRatio} : 1 ({Math.round((rwRatio / (rwRatio + 1)) * 100)}% reads)</span>
            </div>
            <input
              id={rwRatioId}
              type="range"
              min={1}
              max={50}
              step={1}
              value={rwRatio}
              onChange={(e) => {
                setRwRatio(Number(e.target.value));
                setActivePreset("custom");
              }}
              className="w-full"
              aria-label="Read to Write Ratio"
            />
            <div className="flex justify-between text-2xs text-ink-faint font-mono">
              <span>1:1 (Write-Heavy)</span>
              <span>20:1</span>
              <span>50:1 (Read-Heavy)</span>
            </div>
          </div>

          {/* Payload Size */}
          <div className="space-y-1.5 rounded-lg border border-line bg-zinc-50/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor={payloadId} className="font-medium text-ink">
                Average Payload Size
              </label>
              <span className="font-mono font-semibold text-accent">{payloadKb} KB / request</span>
            </div>
            <input
              id={payloadId}
              type="range"
              min={0.5}
              max={100}
              step={0.5}
              value={payloadKb}
              onChange={(e) => {
                setPayloadKb(Number(e.target.value));
                setActivePreset("custom");
              }}
              className="w-full"
              aria-label="Payload size in KB"
            />
            <div className="flex justify-between text-2xs text-ink-faint font-mono">
              <span>0.5 KB</span>
              <span>50 KB</span>
              <span>100 KB</span>
            </div>
          </div>
        </div>

        {/* Results / Calculated Architecture Hardware (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Average QPS */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
              <span className="font-mono text-2xs uppercase text-ink-faint">Average Throughput</span>
              <div className="mt-1 font-mono text-xl font-bold text-ink sm:text-2xl">
                {avgQps.toLocaleString()}
              </div>
              <span className="text-2xs text-ink-mute">requests / second</span>
            </div>

            {/* Peak QPS */}
            <div className="rounded-xl border border-accent-border bg-accent-soft p-3.5 shadow-xs">
              <span className="font-mono text-2xs uppercase text-accent-ink font-semibold">Peak QPS (2.5×)</span>
              <div className="mt-1 font-mono text-xl font-bold text-accent sm:text-2xl">
                {peakQps.toLocaleString()}
              </div>
              <span className="text-2xs text-accent-ink">target for autoscaling</span>
            </div>

            {/* Write IOPS */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
              <span className="font-mono text-2xs uppercase text-ink-faint">Peak Write IOPS</span>
              <div className="mt-1 font-mono text-xl font-bold text-amber-600 sm:text-2xl">
                {peakWriteQps.toLocaleString()}
              </div>
              <span className="text-2xs text-ink-mute">durability path load</span>
            </div>

            {/* Storage / Day */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
              <span className="font-mono text-2xs uppercase text-ink-faint">Daily New Storage</span>
              <div className="mt-1 font-mono text-lg font-bold text-ink sm:text-xl">
                {dailyStorageTb >= 1
                  ? `${dailyStorageTb.toFixed(2)} TB/day`
                  : `${dailyStorageGb.toFixed(1)} GB/day`}
              </div>
              <span className="text-2xs text-ink-mute">uncompressed writes</span>
            </div>

            {/* 5-Yr Storage with 3x Rep */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
              <span className="font-mono text-2xs uppercase text-ink-faint">5-Year Projected (3× Rep)</span>
              <div className="mt-1 font-mono text-lg font-bold text-purple-700 sm:text-xl">
                {fiveYearStorageTb >= 1000
                  ? `${(fiveYearStorageTb / 1024).toFixed(1)} PB`
                  : `${Math.round(fiveYearStorageTb)} TB`}
              </div>
              <span className="text-2xs text-ink-mute">multi-AZ replication</span>
            </div>

            {/* 80/20 RAM Cache */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-xs">
              <span className="font-mono text-2xs uppercase text-emerald-800 font-semibold">80/20 Hot Cache RAM</span>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-700 sm:text-xl">
                {cacheRamNeededGb >= 1024
                  ? `${(cacheRamNeededGb / 1024).toFixed(1)} TB`
                  : `${cacheRamNeededGb} GB`}
              </div>
              <span className="text-2xs text-emerald-800">20% daily working set</span>
            </div>
          </div>

          {/* Engineering Blueprint Recommendations */}
          <div className="rounded-xl border border-line bg-zinc-50 p-4 text-xs">
            <h4 className="font-mono text-2xs uppercase tracking-wider text-ink font-semibold">
              Recommended Hardware Architecture Sizing:
            </h4>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2 text-ink-soft">
              <div className="flex items-start gap-2">
                <span className="text-ok font-bold">✓</span>
                <div>
                  <strong className="text-ink">Database Tier: </strong>
                  Requires at least <span className="font-mono font-semibold text-ink">{recommendedShards}</span> database shard{recommendedShards > 1 ? "s" : ""} to keep write IOPS below SSD thresholds.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-ok font-bold">✓</span>
                <div>
                  <strong className="text-ink">Redis In-Memory Cluster: </strong>
                  Recommend <span className="font-mono font-semibold text-ink">{recommendedRedisNodes} × 64GB nodes</span> with LRU eviction and replication.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-ok font-bold">✓</span>
                <div>
                  <strong className="text-ink">Network Ingress/Egress: </strong>
                  <span className="font-mono font-semibold text-ink">
                    {ingressMbps >= 1000 ? `${(ingressMbps / 1000).toFixed(2)} Gbps in` : `${Math.round(ingressMbps)} Mbps in`} /{" "}
                    {egressMbps >= 1000 ? `${(egressMbps / 1000).toFixed(2)} Gbps out` : `${Math.round(egressMbps)} Mbps out`}
                  </span>.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-ok font-bold">✓</span>
                <div>
                  <strong className="text-ink">Edge Strategy: </strong>
                  Terminate {Math.round((rwRatio / (rwRatio + 1)) * 95)}% of reads at CDN Edge to protect origin infrastructure.
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-line/60 pt-2.5 flex items-center justify-between">
              <span className="text-2xs text-ink-faint">
                Every chapter in the academy includes interactive capacity estimation worksheets with exact formulas.
              </span>
              <Link
                href="/academy/learn/core-design/capacity-estimation"
                className="font-medium text-accent hover:text-accent-hover text-2xs underline ml-2 shrink-0"
              >
                Learn Capacity Estimation Track →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
