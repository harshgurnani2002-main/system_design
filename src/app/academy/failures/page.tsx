import type { Metadata } from "next";
import { FailuresClient } from "@/components/sims/FailuresClient";

export const metadata: Metadata = {
  title: "Break The System",
  description: "Production incident case files: diagnose real failure modes from symptoms, logs and metrics.",
};

export default function FailuresPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-danger">Failure engineering</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Break The System</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Five production incident case files. Read the symptoms, the logs, the dashboards — commit to a diagnosis
          before revealing the root cause. This is the skill that pays salaries.
        </p>
      </header>
      <div className="py-8">
        <FailuresClient />
      </div>
    </div>
  );
}
