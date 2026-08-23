export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** 1234567 -> "1.23M" */
export function fmtCompact(n: number, digits = 1): string {
  if (!isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(digits) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(digits) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(digits) + "K";
  return Math.round(n).toString();
}

export function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
  if (ms >= 10) return Math.round(ms) + "ms";
  return ms.toFixed(1) + "ms";
}

export function fmtPct(p: number, digits = 0): string {
  return (p * 100).toFixed(digits) + "%";
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
