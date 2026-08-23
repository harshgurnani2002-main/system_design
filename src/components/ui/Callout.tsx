import { cn } from "@/lib/utils";

const kinds = {
  info: {
    wrap: "border-accent-border bg-accent-soft",
    label: "text-accent-ink",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7.2v3.3M8 5.2v.2" strokeLinecap="round" />
      </svg>
    ),
  },
  warn: {
    wrap: "border-warn-border bg-warn-soft",
    label: "text-warn-ink",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2.5 14 13H2L8 2.5Z" strokeLinejoin="round" />
        <path d="M8 6.8v2.7M8 11.4v.2" strokeLinecap="round" />
      </svg>
    ),
  },
  danger: {
    wrap: "border-danger-border bg-danger-soft",
    label: "text-danger-ink",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" strokeLinecap="round" />
      </svg>
    ),
  },
  ok: {
    wrap: "border-ok-border bg-ok-soft",
    label: "text-ok-ink",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.2 8.2l2 2 3.6-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
} as const;

export function Callout({
  kind = "info",
  title,
  md,
}: {
  kind?: keyof typeof kinds;
  title?: string;
  md: string;
}) {
  const k = kinds[kind];
  return (
    <aside className={cn("rounded-xl border p-4", k.wrap)}>
      <div className={cn("flex items-center gap-2 text-[13px] font-semibold", k.label)}>
        {k.icon}
        {title ?? (kind === "danger" ? "Failure mode" : kind === "warn" ? "Watch out" : kind === "ok" ? "In practice" : "Note")}
      </div>
      <div className="prose-academy mt-1.5 text-sm leading-relaxed text-ink-soft">
        <Inline md={md} />
      </div>
    </aside>
  );
}

/** Renders **bold** and `code` inline. */
export function Inline({ md }: { md: string }) {
  const parts = md.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
