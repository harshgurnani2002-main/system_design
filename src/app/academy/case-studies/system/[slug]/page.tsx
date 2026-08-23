import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SYSTEMS, getSystem } from "@/content/systems";
import { SystemClient } from "./SystemClient";

export function generateStaticParams() {
  return SYSTEMS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cs = getSystem(slug);
  return cs ? { title: `${cs.name} — case study`, description: cs.tagline } : { title: "Case study" };
}

export default async function SystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const cs = getSystem(slug);
  if (!cs) notFound();

  const idx = SYSTEMS.findIndex((s) => s.slug === slug);
  const prev = idx > 0 ? SYSTEMS[idx - 1] : null;
  const next = idx < SYSTEMS.length - 1 ? SYSTEMS[idx + 1] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <SystemClient cs={cs} initialTab={sp.tab} />

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        {prev ? (
          <Link href={`/academy/case-studies/system/${prev.slug}`} className="text-xs text-ink-mute transition-colors hover:text-accent">
            ← {prev.name}
          </Link>
        ) : (
          <span />
        )}
        <span className="font-mono text-2xs text-ink-faint">{idx + 1} / {SYSTEMS.length}</span>
        {next && (
          <Link href={`/academy/case-studies/system/${next.slug}`} className="text-sm font-medium text-accent transition-colors hover:text-accent-hover">
            {next.name} →
          </Link>
        )}
      </footer>
    </div>
  );
}
