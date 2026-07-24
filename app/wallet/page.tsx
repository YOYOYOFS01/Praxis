"use client";

import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-xl w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[32px] font-bold text-on-surface tracking-tight mb-xs">Wallet Management</h1>
          <p className="font-body text-on-surface-variant">Connect and manage your blockchain identities for agentic transactions.</p>
        </div>
        <WalletConnectButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Main Wallet Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-emerald-500/40 via-surface to-surface-container-high shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
          <div className="relative bg-surface-container-lowest h-full rounded-2xl p-xl flex flex-col backdrop-blur-3xl">
            <div className="flex justify-between items-start mb-xl">
              <div>
                <p className="text-on-surface-variant font-status text-[11px] mb-xs">TOTAL BALANCE</p>
                <div className="flex items-end gap-sm">
                  <h2 className="font-display text-4xl font-bold text-on-surface">
                    {isConnected && balance ? parseFloat(balance.formatted).toFixed(4) : "0.0000"}
                  </h2>
                  <span className="text-emerald-400 font-bold mb-1">{balance?.symbol || "ETH"}</span>
                </div>
              </div>
              <div className="bg-surface-container-high px-md py-sm rounded-full border border-outline-variant/50 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-error"}`} />
                <span className="text-xs font-medium text-on-surface">{isConnected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>

            <div className="mt-auto">
              <p className="text-on-surface-variant font-status text-[11px] mb-xs">PRIMARY ADDRESS</p>
              <div className="flex items-center gap-md">
                <div className="bg-surface-container font-mono text-sm px-4 py-2 rounded-lg text-on-surface border border-outline-variant/30 w-full truncate">
                  {isConnected ? address : "Connect a wallet to view address"}
                </div>
                {isConnected && (
                  <button className="bg-primary text-on-primary p-2 rounded-lg hover:bg-inverse-surface transition-colors">
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Security Controls */}
        <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-lg flex flex-col shadow-sm">
          <h3 className="font-section-title text-lg text-on-surface mb-md flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary">lock</span> Security Controls
          </h3>
          
          <div className="flex flex-col gap-md flex-1">
            <div className="bg-surface-container p-md rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">Wallet PIN</p>
                <p className="text-xs text-on-surface-variant mt-1">Require PIN for transactions</p>
              </div>
              <button className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium hover:bg-primary/20 transition-colors">
                Setup
              </button>
            </div>

            <div className="bg-surface-container p-md rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">Spending Limits</p>
                <p className="text-xs text-on-surface-variant mt-1">Cap agent expenditures</p>
              </div>
              <button className="text-xs bg-surface-container-highest text-on-surface px-3 py-1.5 rounded-full font-medium hover:bg-surface-container-high transition-colors">
                Configure
              </button>
            </div>

            <div className="bg-surface-container p-md rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">Session Expiry</p>
                <p className="text-xs text-on-surface-variant mt-1">Auto-lock after 15 mins</p>
              </div>
              <span className="material-symbols-outlined text-success text-[18px]">check_circle</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Transaction History Placeholder */}
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-lg shadow-sm">
        <h3 className="font-section-title text-lg text-on-surface mb-md">Recent Agent Activity</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-md border border-outline-variant">
            <span className="material-symbols-outlined text-on-surface-variant text-[28px]">history</span>
          </div>
          <p className="text-on-surface font-medium">No recent transactions</p>
          <p className="text-sm text-on-surface-variant mt-1 max-w-md">Once your AI agent executes transactions on your behalf, they will appear here with cryptographically verifiable proofs.</p>
        </div>
      </div>
    </div>
  );
}
