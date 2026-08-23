"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Slider, Stat } from "@/components/ui/Controls";
import { cn, fmtCompact } from "@/lib/utils";

/* ================================================================== */
/*  Capacity estimation calculators                                    */
/* ================================================================== */

function Field({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-soft">{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="tabular w-24 rounded-md border border-line bg-surface px-2 py-1 text-right font-mono text-xs focus:border-accent focus:outline-none"
          aria-label={label}
        />
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-hidden tabIndex={-1} />
      {suffix && <div className="mt-0.5 text-right text-2xs text-ink-faint">{suffix}</div>}
    </label>
  );
}

export function CapacityCalc() {
  const [tab, setTab] = useState("qps");
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-4 pt-3">
        <Tabs
          tabs={[
            { id: "qps", label: "QPS" },
            { id: "storage", label: "Storage" },
            { id: "bandwidth", label: "Bandwidth" },
            { id: "cache", label: "Cache size" },
          ]}
          active={tab}
          onChange={setTab}
          className="mb-3 w-fit"
        />
      </div>
      <div className="p-4">
        {tab === "qps" && <QpsCalc />}
        {tab === "storage" && <StorageCalc />}
        {tab === "bandwidth" && <BandwidthCalc />}
        {tab === "cache" && <CacheCalc />}
      </div>
    </div>
  );
}

function QpsCalc() {
  const [usersDay, setUsersDay] = useState(5_000_000);
  const [reqsUser, setReqsUser] = useState(20);
  const [peak, setPeak] = useState(4);
  const avg = (usersDay * reqsUser) / 86_400;
  const peakQps = avg * peak;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label="Requests / day" value={usersDay} onChange={setUsersDay} max={500_000_000} step={100_000} />
        <Field label="Requests per user per day" value={reqsUser} onChange={setReqsUser} max={200} />
        <Slider label="Peak factor" value={peak} min={1} max={10} step={0.5} onChange={setPeak} format={(v) => `${v}× average`} hint="Traffic peaks 2–5× at lunch/prime-time; celebrity events go higher." />
      </div>
      <div className="space-y-2">
        <Stat label="Average QPS" value={fmtCompact(avg)} sub={`${usersDay.toLocaleString()} × ${reqsUser} ÷ 86,400`} tone="accent" />
        <Stat label="Peak QPS" value={fmtCompact(peakQps)} sub={`design target · ${peak}× avg`} tone={peakQps > 100_000 ? "warn" : "ok"} />
        <Stat label="Per-second shortcut" value={usersDay >= 1e6 ? `${fmtCompact(usersDay / 1e6)}M/day ≈ ${Math.round(usersDay / 86400)}/s` : "—"} sub="÷10⁵ mental math for M/day" />
      </div>
    </div>
  );
}

function StorageCalc() {
  const [itemsDay, setItemsDay] = useState(2_000_000);
  const [sizeKb, setSizeKb] = useState(500);
  const [years, setYears] = useState(3);
  const [rf, setRf] = useState(3);
  const perDayGb = (itemsDay * sizeKb) / 1e6;
  const totalTb = (perDayGb * 365 * years);
  const provisioned = totalTb * rf;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label="New items / day" value={itemsDay} onChange={setItemsDay} max={200_000_000} step={50_000} />
        <Field label="Average item size (KB)" value={sizeKb} onChange={setSizeKb} max={5000} step={10} />
        <Slider label="Horizon (years)" value={years} min={1} max={10} onChange={setYears} format={(v) => `${v} yr`} />
        <Slider label="Replication factor" value={rf} min={1} max={5} onChange={(v) => setRf(v)} format={(v) => `×${v}`} hint="Production durability wants ×3." />
      </div>
      <div className="space-y-2">
        <Stat label="Growth / day" value={`${perDayGb.toFixed(1)} GB`} tone="neutral" />
        <Stat label={`Raw @ ${years}y`} value={`${fmtCompact(totalTb)} TB`} sub="before replication/indexes" tone="accent" />
        <Stat label="Provisioned" value={`${fmtCompact(provisioned)} TB`} sub={`×${rf} durability + ~30% headroom → plan ${fmtCompact(provisioned * 1.3)} TB`} tone={provisioned > 1000 ? "warn" : "ok"} />
      </div>
    </div>
  );
}

function BandwidthCalc() {
  const [readQps, setReadQps] = useState(20_000);
  const [respKb, setRespKb] = useState(120);
  const gbps = (readQps * respKb * 8) / 1e6;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label="Read QPS" value={readQps} onChange={setReadQps} max={500_000} step={1000} />
        <Field label="Average response (KB)" value={respKb} onChange={setRespKb} max={5000} step={10} />
      </div>
      <div className="space-y-2">
        <Stat label="Egress" value={`${gbps.toFixed(1)} Gbps`} sub={`${readQps.toLocaleString()} req/s × ${respKb}KB × 8 bits`} tone={gbps > 10 ? "warn" : "ok"} />
        <Stat label="Monthly transfer" value={`${fmtCompact((gbps / 8) * 2.6e6 / 1000)} TB`} sub="≈ 2.6M seconds/month" />
        {gbps > 10 && (
          <p className="rounded-lg border border-warn-border bg-warn-soft px-3 py-2 text-2xs leading-snug text-warn-ink">
            &gt;10 Gbps from origin means one thing: this belongs behind a CDN.
          </p>
        )}
      </div>
    </div>
  );
}

function CacheCalc() {
  const [activeKeys, setActiveKeys] = useState(50_000_000);
  const [valueKb, setValueKb] = useState(2);
  const [overhead, setOverhead] = useState(1.5);
  const memGb = (activeKeys * valueKb * overhead) / 1e6;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label="Hot keys (working set)" value={activeKeys} onChange={setActiveKeys} max={1_000_000_000} step={1_000_000} />
        <Field label="Average value (KB)" value={valueKb} onChange={setValueKb} max={512} />
        <Slider label="Redis overhead factor" value={overhead} min={1.1} max={3} step={0.1} onChange={setOverhead} format={(v) => `×${v.toFixed(1)}`} hint="Pointers + allocator overhead; 1.5× is a realistic planning default." />
      </div>
      <div className="space-y-2">
        <Stat label="Memory needed" value={`${memGb.toFixed(1)} GB`} sub="per cache tier" tone="accent" />
        <Stat label="Cluster suggestion" value={memGb > 100 ? "Sharded cluster" : "Single primary + replica"} sub={memGb > 100 ? `${Math.ceil(memGb / 60)} nodes × 64GB` : "with AOF everysec"} tone="neutral" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Token bucket visual                                                */
/* ================================================================== */

interface Drop { ok: boolean; t: number }

export function TokenBucket() {
  const [rate, setRate] = useState(4); // tokens/sec
  const [cap, setCap] = useState(20);
  const [burst, setBurst] = useState(12);
  const tokensRef = useRef(cap);
  const [level, setLevel] = useState(cap);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [stats, setStats] = useState({ ok: 0, rejected: 0 });
  const rafRef = useRef<number>(0);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    tokensRef.current = Math.min(cap, rate); // start half-full-ish
    const tick = (t: number) => {
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      tokensRef.current = Math.min(cap, tokensRef.current + rate * dt);
      setLevel(tokensRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [rate, cap]);

  function fire(n: number) {
    let ok = 0;
    for (let i = 0; i < n; i++) {
      if (tokensRef.current >= 1) {
        tokensRef.current -= 1;
        ok++;
      }
    }
    const rejected = n - ok;
    setStats((s) => ({ ok: s.ok + ok, rejected: s.rejected + rejected }));
    const stamp = Date.now();
    setDrops((d) => [
      ...d.slice(-23),
      ...Array.from({ length: Math.min(n, 12) }, (_, i) => ({ ok: i < Math.ceil((ok / n) * 12), t: stamp + i })),
    ]);
  }

  const pct = level / cap;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* bucket */}
        <div className="flex items-end justify-center gap-4">
          <svg width={110} height={150} viewBox="0 0 110 150" role="img" aria-label="Token bucket fill level">
            <defs>
              <clipPath id="bucketClip"><rect x="15" y="15" width="80" height="120" rx="10" /></clipPath>
            </defs>
            <rect x="15" y="15" width="80" height="120" rx="10" fill="#F4F4F5" stroke="#D4D4D8" />
            <g clipPath="url(#bucketClip)">
              <rect x="15" y={135 - 120 * pct} width="80" height={120 * pct} fill="#2563EB" opacity="0.85" style={{ transition: "y 80ms linear, height 80ms linear" }} />
            </g>
            <text x="55" y="148" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#71717A">
              {Math.floor(level)}/{cap} tokens
            </text>
          </svg>
          <div className="text-left text-2xs leading-relaxed text-ink-mute">
            refill <span className="font-mono text-accent">{rate}/s</span><br />
            capacity <span className="font-mono text-accent">{cap}</span><br />
            sustained cap <span className="font-mono">{rate}/s</span>
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Refill rate" value={rate} min={1} max={20} onChange={setRate} format={(v) => `${v} tokens/s`} />
            <Slider label="Bucket capacity" value={cap} min={5} max={60} onChange={setCap} format={(v) => `${v} tokens`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[1, burst, 40].map((n, i) => (
              <button
                key={i}
                onClick={() => fire(i === 0 ? 1 : i === 1 ? burst : 40)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent hover:text-accent"
              >
                Send {i === 0 ? "request" : `${n} requests`}
              </button>
            ))}
            <button onClick={() => fire(burst)} className="sr-only">burst</button>
          </div>
          <div className="flex h-8 items-center gap-1 overflow-hidden rounded-lg border border-line bg-zinc-50 px-2">
            {drops.slice(-24).map((d, i) => (
              <span key={d.t + "-" + i} className={cn("h-2 w-2 rounded-full", d.ok ? "bg-ok" : "bg-danger")} title={d.ok ? "accepted" : "429"} />
            ))}
            {drops.length === 0 && <span className="text-2xs text-ink-faint">Send requests to see admits vs 429s…</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Accepted" value={stats.ok} tone="ok" />
            <Stat label="Rejected (429)" value={stats.rejected} tone={stats.rejected > 0 ? "danger" : "neutral"} />
            <Stat label="Burst allowed" value={burst} sub="consumes capacity instantly" />
          </div>
          <p className="text-2xs leading-relaxed text-ink-faint">
            Try: capacity 20, then send 40 at once — 20 pass instantly (the stored burst), the rest get 429 until the bucket refills at {rate}/s.
            This is why token buckets feel fair to humans while still capping averages.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Replication lag visual                                             */
/* ================================================================== */

export function ReplicationLag() {
  const [lagMs, setLagMs] = useState(800);
  const [sticky, setSticky] = useState(false);
  const [writes, setWrites] = useState<{ v: number; writtenAt: number }[]>([]);
  const [readResult, setReadResult] = useState<{ got: number | null; staleBy: number } | null>(null);
  const counter = useRef(0);
  const [, setTick] = useState(0); // drive dot animation

  // replica applies writes after lag
  const appliedRef = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => {
      const cutoff = Date.now() - lagMs;
      while (appliedRef.current < writes.length && writes[appliedRef.current].writtenAt <= cutoff) appliedRef.current++;
      setTick((t) => t + 1);
    }, 90);
    return () => clearInterval(iv);
  }, [lagMs, writes]);

  function doWrite() {
    counter.current += 1;
    setWrites((w) => [...w.slice(-14), { v: counter.current, writtenAt: Date.now() }]);
    setReadResult(null);
  }

  function doRead(routeReplica: boolean) {
    if (!routeReplica || sticky) {
      const latest = writes[writes.length - 1]?.v ?? null;
      setReadResult({ got: latest, staleBy: 0 });
    } else {
      const applied = writes[Math.max(0, appliedRef.current - 1)]?.v ?? null;
      const staleBy = Date.now() - (writes[Math.max(0, appliedRef.current - 1)]?.writtenAt ?? Date.now());
      setReadResult({ got: applied, staleBy });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <svg viewBox="0 0 520 190" className="w-full" role="img" aria-label="Primary replicating writes to a lagging replica">
            <rect x="10" y="70" width="130" height="52" rx="11" fill="#F5F3FF" stroke="#C4B5FD" />
            <text x="75" y="92" textAnchor="middle" fontSize="13" fontWeight="600" fill="#5B21B6">Primary</text>
            <text x="75" y="108" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#71717A">accepts writes</text>
            <rect x="380" y="70" width="130" height="52" rx="11" fill="#F5F3FF" stroke="#C4B5FD" />
            <text x="445" y="92" textAnchor="middle" fontSize="13" fontWeight="600" fill="#5B21B6">Replica</text>
            <text x="445" y="108" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#71717A">applies WAL late</text>
            <path d="M140 96 H 380" stroke="#A1A1AA" strokeWidth="1.5" markerEnd="url(#arrow-n2)" />
            <defs>
              <marker id="arrow-n2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 1.5 L9 5 L0 8.5 z" fill="#A1A1AA" />
              </marker>
            </defs>
            {writes.map((w, i) => {
              const age = Date.now() - w.writtenAt;
              const progress = Math.min(1, age / Math.max(lagMs, 1));
              const x = 140 + progress * 230;
              return <circle key={w.v} cx={x} cy={96} r={progress >= 1 ? 0 : 4} fill="#7C3AED" opacity={progress >= 1 ? 0 : 0.9} />;
            })}
            <text x="260" y="82" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#71717A">replication delay {lagMs}ms</text>
          </svg>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={doWrite} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">Write v{counter.current + 1}</button>
            <button onClick={() => doRead(false)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent hover:text-accent">Read from replica</button>
            <button onClick={() => doRead(true)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium", sticky ? "border-ok-border bg-ok-soft text-ok-ink" : "border-line bg-surface hover:border-accent hover:text-accent")}>
              Read {sticky ? "(stuck to primary)" : "from primary"}
            </button>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-2xs text-ink-mute">
              <input type="checkbox" checked={sticky} onChange={(e) => setSticky(e.target.checked)} className="accent-blue-600" />
              sticky read-your-writes routing
            </label>
          </div>
        </div>
        <div className="space-y-3">
          <Slider label="Replication lag" value={lagMs} min={0} max={4000} step={100} onChange={setLagMs} format={(v) => `${(v / 1000).toFixed(1)}s`} hint="Async replicas lag under write load. Failover can also LOSE this tail." />
          <Stat label="Last write" value={writes.length ? `v${writes[writes.length - 1].v}` : "—"} tone="accent" />
          <Stat
            label="Your read returned"
            value={readResult ? (readResult.got !== null ? `v${readResult.got}` : "empty") : "—"}
            sub={readResult ? (readResult.staleBy > 0 ? `STALE by ${(readResult.staleBy / 1000).toFixed(1)}s — your own write invisible!` : "fresh ✓") : "press read"}
            tone={readResult && readResult.staleBy > 0 ? "danger" : "ok"}
          />
          <p className="text-2xs leading-relaxed text-ink-faint">
            Write then immediately read from the replica with lag &gt; 0: your own data is missing. That&apos;s why production systems pin post-write reads to the primary (stickiness) or check replication offsets per query.
          </p>
        </div>
      </div>
    </div>
  );
}
