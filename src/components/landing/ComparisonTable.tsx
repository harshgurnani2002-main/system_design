"use client";

export function ComparisonTable() {
  const features = [
    {
      feature: "Architecture Visuals",
      traditional: "Static PNG diagrams or whiteboard drawings with no animation.",
      academy: "Interactive SVG topologies with live packet flows, hop-by-hop tracing & component inspection.",
    },
    {
      feature: "Capacity Estimation",
      traditional: "Passive math formulas written on slides that you try to memorize.",
      academy: "Live reactive calculators for QPS, IOPS, storage, and 80/20 RAM cache sizing.",
    },
    {
      feature: "System Failures & Chaos",
      traditional: "Bullet points explaining 'failures happen' with zero hands-on debugging.",
      academy: "Live Chaos Injection Lab: test cache stampedes, retry storms, and trigger circuit breakers.",
    },
    {
      feature: "Hands-on Practice",
      traditional: "Watching hours of passive video lectures with no active feedback loop.",
      academy: "Drag-and-drop architecture builder with real-time linter checking for SPOFs and bottlenecks.",
    },
    {
      feature: "Real-World Case Studies",
      traditional: "Generic high-level summaries of YouTube and Twitter from 10 years ago.",
      academy: "20 complete reconstructions (Instagram, Uber, Netflix, WhatsApp, Stripe) with failure labs.",
    },
    {
      feature: "Interview Preparation",
      traditional: "Unstructured cram sheets and memorized scripts that break during follow-up questions.",
      academy: "Structured 45-minute drills testing requirements, capacity math, trade-offs, and edge cases.",
    },
  ];

  return (
    <section aria-labelledby="comparison-heading" className="space-y-6">
      <div className="text-center max-w-3xl mx-auto">
        <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
          Active Simulation vs Passive Lectures
        </span>
        <h2 id="comparison-heading" className="mt-1 text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Built for Engineers Who Learn by Doing
        </h2>
        <p className="mt-2 text-sm text-ink-soft leading-relaxed">
          System design isn&apos;t a spectator sport. Here&apos;s why interactive simulations build deeper intuition than 40 hours of video courses.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-pop">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-zinc-50/80">
              <th scope="col" className="p-4 font-mono uppercase text-2xs text-ink-mute font-semibold w-1/4">
                Capability
              </th>
              <th scope="col" className="p-4 font-mono uppercase text-2xs text-ink-mute font-semibold w-3/8">
                Typical Video Courses &amp; Books
              </th>
              <th scope="col" className="p-4 font-mono uppercase text-2xs text-accent-ink font-bold w-3/8 bg-accent-soft/40 border-l border-accent-border">
                ⚡ System Design Academy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {features.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                <th scope="row" className="p-4 font-semibold text-ink align-top">
                  {row.feature}
                </th>
                <td className="p-4 text-ink-mute align-top leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold text-sm shrink-0">✕</span>
                    <span>{row.traditional}</span>
                  </div>
                </td>
                <td className="p-4 font-medium text-ink-soft align-top leading-relaxed bg-accent-soft/20 border-l border-accent-border">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold text-sm shrink-0">✓</span>
                    <span className="text-ink">{row.academy}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
