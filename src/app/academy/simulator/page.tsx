import type { Metadata } from "next";
import { SimulatorClient } from "@/components/sims/SimulatorClient";

export const metadata: Metadata = {
  title: "System Simulator",
  description: "Overload a live architecture and watch cascading failure — then learn the patterns that survive.",
};

export default function SimulatorPage() {
  return <SimulatorClient />;
}
