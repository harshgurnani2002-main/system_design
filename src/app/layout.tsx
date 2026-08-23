import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "System Design Academy — Learn by building real systems",
    template: "%s · System Design Academy",
  },
  description:
    "An interactive academy for scalable system design. See it, build it, break it, debug it, deploy it — from your first API to globally distributed infrastructure.",
  metadataBase: new URL("https://system-design-orpin.vercel.app"),
  openGraph: {
    title: "System Design Academy — Learn by building real systems",
    description:
      "Interactive curriculum, architectural simulations, failure drills, and hands-on distributed systems labs.",
    url: "https://system-design-orpin.vercel.app",
    siteName: "System Design Academy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "System Design Academy",
    description: "Learn scalable system architecture with interactive simulations and real-world failure drills.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
