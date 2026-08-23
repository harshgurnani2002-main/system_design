"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-zinc-900/25 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={ref}
        className={cn(
          "animate-fadeUp w-full rounded-xl border border-line bg-surface shadow-pop",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1 text-ink-mute hover:bg-zinc-100 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Tabs ---------------- */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-1 rounded-lg border border-line bg-zinc-50 p-1", className)}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === t.id
              ? "bg-surface text-ink shadow-node"
              : "text-ink-mute hover:text-ink"
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className="font-mono text-2xs text-ink-faint">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Slider ---------------- */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", disabled && "opacity-50")}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-soft">{label}</span>
        <span className="tabular font-mono text-xs font-semibold text-accent">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="mt-1 text-2xs leading-snug text-ink-faint">{hint}</p>}
    </label>
  );
}

/* ---------------- Stat tile ---------------- */
export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
}) {
  const toneCls = {
    neutral: "text-ink",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    accent: "text-accent",
  }[tone];
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="text-2xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className={cn("tabular mt-0.5 font-mono text-lg font-semibold leading-tight", toneCls)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-2xs text-ink-mute">{sub}</div>}
    </div>
  );
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({
  data,
  max,
  color = "#2563EB",
  height = 40,
  threshold,
}: {
  data: number[];
  max?: number;
  color?: string;
  height?: number;
  threshold?: number;
}) {
  const w = 160;
  const top = max ?? Math.max(1, ...data);
  const pts = data.length
    ? data
        .map((v, i) => {
          const x = (i / Math.max(1, data.length - 1)) * w;
          const y = height - (Math.min(v, top) / top) * (height - 4) - 2;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : "";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" aria-hidden>
      {threshold !== undefined && (
        <line
          x1="0"
          x2={w}
          y1={height - (threshold / top) * (height - 4) - 2}
          y2={height - (threshold / top) * (height - 4) - 2}
          stroke="#DC2626"
          strokeDasharray="3 3"
          strokeWidth="1"
          opacity="0.55"
        />
      )}
      {pts && (
        <>
          <polyline points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity="0.08" />
          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
