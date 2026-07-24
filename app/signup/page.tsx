"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const calculateStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: "", color: "bg-surface-dim" };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^a-zA-Z\d]/.test(pwd)) score += 1;

    if (score <= 1) return { label: "Weak", color: "bg-error", w: "w-1/4" };
    if (score === 2) return { label: "Fair", color: "bg-warning", w: "w-2/4" };
    if (score === 3) return { label: "Good", color: "bg-pending", w: "w-3/4" };
    return { label: "Strong", color: "bg-success", w: "w-full" };
  };

  const strength = calculateStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!termsAccepted) {
      setError("You must accept the terms of service");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-lg">
      <div className="w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant rounded-xl p-xl auth-card flex flex-col gap-lg">
        
        <div className="text-center">
          <h1 className="font-display text-[28px] font-bold text-on-surface mb-xs tracking-tight">Create an account</h1>
          <p className="font-body text-body text-on-surface-variant">Join Praxis to manage your assets</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {error && (
            <div className="bg-error-container text-error px-md py-sm rounded-lg font-body text-caption border border-error/20 flex items-center gap-sm">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-sm">
            <label className="font-status text-status text-on-surface">FULL NAME</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
              placeholder="Satoshi Nakamoto"
            />
          </div>

          <div className="flex flex-col gap-sm">
            <label className="font-status text-status text-on-surface">EMAIL ADDRESS</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
              placeholder="name@company.com"
              required 
            />
          </div>
          
          <div className="flex flex-col gap-sm">
            <label className="font-status text-status text-on-surface">PASSWORD</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
              placeholder="••••••••"
              required 
              minLength={8}
            />
            {password && (
              <div className="w-full mt-1">
                <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.w} transition-all duration-300`}></div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-status text-[10px] text-on-surface-variant uppercase tracking-wider">{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-sm">
            <label className="font-status text-status text-on-surface">CONFIRM PASSWORD</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
              placeholder="••••••••"
              required 
            />
          </div>
          
          <label className="flex items-start gap-sm cursor-pointer group mt-2">
            <div className="relative flex items-center justify-center w-4 h-4 mt-0.5 shrink-0">
              <input 
                type="checkbox" 
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="appearance-none w-4 h-4 border border-outline-variant rounded bg-surface-container-low checked:bg-primary checked:border-primary transition-colors cursor-pointer peer"
                required
              />
              <span className="material-symbols-outlined text-[12px] text-on-primary absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
            </div>
            <span className="font-body text-caption text-on-surface-variant group-hover:text-on-surface transition-colors leading-snug">
              I accept the <Link href="#" className="text-primary underline">Terms of Service</Link> and <Link href="#" className="text-primary underline">Privacy Policy</Link>
            </span>
          </label>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-on-primary py-sm rounded-lg font-button-label text-button-label btn-interact transition-all hover:bg-inverse-surface disabled:opacity-50 disabled:cursor-not-allowed mt-xs"
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>
        
        <p className="font-body text-body text-on-surface-variant text-center border-t border-outline-variant pt-lg mt-sm">
          Already have an account? <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
