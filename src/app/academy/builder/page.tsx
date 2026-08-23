import type { Metadata } from "next";
import { BuilderClient } from "@/components/builder/BuilderClient";

export const metadata: Metadata = {
  title: "Architecture Builder",
  description: "Drag-and-drop architecture canvas with live design review intelligence.",
};

export default function BuilderPage() {
  return <BuilderClient />;
}
