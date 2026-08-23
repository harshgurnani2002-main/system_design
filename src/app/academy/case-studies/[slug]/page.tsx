import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InstagramEvolution, OrderLifecycle, FailureForensics } from "./CaseStudyClient";

const META: Record<string, { title: string; tagline: string }> = {
  instagram: {
    title: "Instagram",
    tagline:
      "One server to half a billion users in ten deliberate steps. Each version exists because the previous one failed under load.",
  },
  zomato: {
    title: "Food Ordering — the Zomato problem",
    tagline:
      "An order is not a request; it is a distributed workflow across payments, restaurants and drivers. Watch it move through its saga.",
  },
};

export function generateStaticParams() {
  return [{ slug: "instagram" }, { slug: "zomato" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = META[slug];
  return meta ? { title: meta.title } : { title: "Case Study" };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = META[slug];
  if (!meta) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 font-mono text-2xs text-ink-faint">
        <Link href="/academy" className="hover:text-accent">academy</Link>
        <span>/</span>
        <Link href="/academy/case-studies" className="hover:text-accent">case-studies</Link>
        <span>/</span>
        <span className="text-accent">{slug}</span>
      </nav>

      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Case study · architecture evolution</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{meta.title}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-mute">{meta.tagline}</p>
      </header>

      <div className="space-y-12 py-8">
        {slug === "instagram" && (
          <>
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">
                The evolution: V1 → V10
                <span className="ml-2 font-mono text-2xs font-normal text-ink-faint">use the tabs or press evolve</span>
              </h2>
              <InstagramEvolution />
            </section>

            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Where this connects</h2>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
                <li>
                  → The like-storm mechanics (hot keys, batching, sharded counters) are fully interactive in{" "}
                  <Link href="/academy/learn/core-design/caching" className="font-medium text-accent hover:text-accent-hover">Caching &amp; the Like Storm lesson</Link>.
                </li>
                <li>
                  → Fan-out strategies for timelines are a guided interview drill in{" "}
                  <Link href="/academy/interview/instagram-feed" className="font-medium text-accent hover:text-accent-hover">Interview: Design Instagram Feed</Link>.
                </li>
                <li>
                  → Replication and read-your-writes routing are visualized in{" "}
                  <Link href="/academy/learn/data-systems/postgres-scaling" className="font-medium text-accent hover:text-accent-hover">PostgreSQL at Scale</Link>.
                </li>
              </ul>
            </section>
          </>
        )}

        {slug === "zomato" && (
          <>
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">
                Order lifecycle
                <span className="ml-2 font-mono text-2xs font-normal text-ink-faint">click any state · colors show the owning actor</span>
              </h2>
              <OrderLifecycle />
            </section>

            <section>
              <h2 className="mb-1 text-lg font-semibold tracking-tight text-ink">Failure forensics</h2>
              <p className="mb-4 text-[13px] text-ink-mute">
                Five real production incident shapes. Diagnose each before opening the root cause.
              </p>
              <FailureForensics />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
