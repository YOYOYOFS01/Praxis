import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Praxis — Agent Payment Firewall",
  description: "Autonomous procurement agent with deterministic payment guardrails and on-chain proof anchoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
