import { AcademyShell } from "@/components/shell/AcademyShell";

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return <AcademyShell>{children}</AcademyShell>;
}
