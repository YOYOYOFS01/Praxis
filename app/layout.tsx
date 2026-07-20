import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Praxis — Agent Payment Firewall",
  description: "Autonomous procurement agent with deterministic payment guardrails and on-chain proof anchoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
