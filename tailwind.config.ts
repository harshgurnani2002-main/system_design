import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF9",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#18181B",
          soft: "#3F3F46",
          mute: "#71717A",
          faint: "#A1A1AA",
        },
        line: {
          DEFAULT: "#E4E4E7",
          soft: "#EFEFEE",
          strong: "#D4D4D8",
        },
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          soft: "#EFF6FF",
          border: "#BFDBFE",
          ink: "#1E40AF",
        },
        ok: {
          DEFAULT: "#16A34A",
          soft: "#F0FDF4",
          border: "#BBF7D0",
          ink: "#15803D",
        },
        warn: {
          DEFAULT: "#D97706",
          soft: "#FFFBEB",
          border: "#FDE68A",
          ink: "#92400E",
        },
        danger: {
          DEFAULT: "#DC2626",
          soft: "#FEF2F2",
          border: "#FECACA",
          ink: "#991B1B",
        },
        // diagram semantics
        node: {
          app: { bg: "#EFF6FF", border: "#93C5FD", text: "#1E40AF", dot: "#2563EB" },
          data: { bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6", dot: "#7C3AED" },
          cache: { bg: "#F0FDF4", border: "#86EFAC", text: "#166534", dot: "#16A34A" },
          queue: { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412", dot: "#EA580C" },
          infra: { bg: "#F4F4F5", border: "#D4D4D8", text: "#3F3F46", dot: "#71717A" },
          client: { bg: "#FFFFFF", border: "#D4D4D8", text: "#18181B", dot: "#18181B" },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        node: "0 1px 2px rgba(24,24,27,0.06), 0 0 0 1px rgba(24,24,27,0.04)",
        pop: "0 10px 38px -10px rgba(24,24,27,0.14), 0 10px 20px -15px rgba(24,24,27,0.12)",
        focus: "0 0 0 3px rgba(37,99,235,0.18)",
      },
      keyframes: {
        dashflow: {
          to: { strokeDashoffset: "-28" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        dashflow: "dashflow 0.9s linear infinite",
        fadeUp: "fadeUp 0.35s ease both",
        pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
