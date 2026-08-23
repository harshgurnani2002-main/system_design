import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-ink-soft border-line",
  accent: "bg-accent-soft text-accent-ink border-accent-border",
  ok: "bg-ok-soft text-ok-ink border-ok-border",
  warn: "bg-warn-soft text-warn-ink border-warn-border",
  danger: "bg-danger-soft text-danger-ink border-danger-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium leading-none",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
