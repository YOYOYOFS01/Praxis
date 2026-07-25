"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // Hide the AppShell for authentication routes
  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Unauthorized");
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        // Option to redirect to login if not authenticated
        // router.push("/login");
      });
  }, [pathname, router]);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
      return (parts[0][0] || "U").toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  const navLinks = [
    { name: "Dashboard", href: "/", icon: "dashboard" },
    { name: "Wallet", href: "/wallet", icon: "account_balance_wallet" },
    { name: "Payments", href: "/payments", icon: "payments" },
    { name: "Merchant", href: "/merchant", icon: "storefront" },
    { name: "History", href: "/history", icon: "history" },
    { name: "Analytics", href: "/analytics", icon: "analytics" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background">
      {/* Top Navigation */}
      <header className="flex justify-between items-center px-lg w-full sticky top-0 z-50 bg-surface border-b border-outline-variant h-16">
        <div className="flex items-center gap-xl">
          <span className="font-display text-display text-primary tracking-tighter" style={{ fontSize: "24px", lineHeight: "32px" }}>
            Praxis
          </span>
          <div className="hidden md:flex items-center gap-lg">
            <nav className="flex items-center gap-md">
              <Link href="#" className="text-primary font-bold border-b-2 border-primary py-xs transition-colors">Network Status</Link>
              <Link href="#" className="text-secondary hover:text-primary transition-colors py-xs">Support</Link>
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <WalletConnectButton />
          <div className="flex items-center gap-md text-secondary text-sm font-medium">
            <button className="hover:text-primary active:scale-95 transition-all">
              Notifications
            </button>
            <Link href="/profile" className="hover:text-primary active:scale-95 transition-all" title="Profile">
              Settings
            </Link>
            {user && (
              <Link href="/profile">
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold text-xs border border-outline-variant ml-2">
                  {getInitials(user.name, user.email)}
                </div>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-sidebar-expanded bg-surface-container border-r border-outline-variant flex-col py-lg px-md gap-md overflow-y-auto z-40 hidden md:flex">
          <div className="flex flex-col gap-xs mb-md px-xs">
            <p className="font-section-title text-section-title font-bold text-primary">Praxis Finance</p>
            <p className="font-caption text-caption text-on-surface-variant">Enterprise Vault</p>
          </div>

          <nav className="flex flex-col gap-xs flex-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-md px-md py-sm rounded-lg transition-transform active:scale-[0.98] ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-variant transition-all"
                  }`}
                >
                  <span className="font-button-label text-button-label">{link.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-xs border-t border-outline-variant pt-lg">
            <Link href="/security" className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-variant rounded-lg transition-all">
              <span className="font-button-label text-button-label">Security</span>
            </Link>
            <Link href="/docs" className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-variant rounded-lg transition-all">
              <span className="font-button-label text-button-label">Docs</span>
            </Link>
            <button className="mt-md bg-surface-container-highest text-primary border border-outline px-md py-sm rounded-lg font-button-label text-button-label active:scale-95 transition-transform text-center block w-full">
              New Transaction
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 md:ml-sidebar-expanded p-lg lg:p-xl flex flex-col gap-xl">
          {children}
        </main>
      </div>
    </div>
  );
}
