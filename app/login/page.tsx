"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CaptchaWidget } from "@/components/captcha-widget";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [tempToken, setTempToken] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (failedAttempts >= 3 && !captchaToken) {
        setError("Please complete the CAPTCHA");
        setIsLoading(false);
        return;
      }

      if (totpRequired) {
        const res = await fetch("/api/auth/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempToken, totpCode, rememberMe }),
        });
        if (res.ok) {
          router.push("/");
        } else {
          const data = await res.json();
          setError(data.error || "Invalid 2FA code");
        }
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe, captchaToken }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.requiresTOTP) {
          setTotpRequired(true);
          setTempToken(data.tempToken);
        } else {
          router.push("/");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Email or password is incorrect");
        setFailedAttempts(prev => prev + 1);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-lg">
      <div className="w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant rounded-xl p-xl auth-card flex flex-col gap-xl">
        
        <div className="text-center">
          <h1 className="font-display text-[28px] font-bold text-on-surface mb-xs tracking-tight">Welcome back</h1>
          <p className="font-body text-body text-on-surface-variant">Sign in to your Praxis account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          {error && (
            <div className="bg-error-container text-error px-md py-sm rounded-lg font-body text-caption border border-error/20 flex items-center gap-sm">
              <span className="font-bold text-[16px]">!</span>
              {error}
            </div>
          )}
          
          {!totpRequired ? (
            <>
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
                <div className="flex justify-between items-center">
                  <label className="font-status text-status text-on-surface">PASSWORD</label>
                  <Link href="/auth/forgot-password" className="font-caption text-caption text-primary hover:underline">Forgot password?</Link>
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
                  placeholder="••••••••"
                  required 
                />
              </div>

              {failedAttempts >= 3 && (
                <CaptchaWidget onVerify={(token) => setCaptchaToken(token)} />
              )}
              
              <label className="flex items-center gap-sm cursor-pointer group">
                <div className="relative flex items-center justify-center w-4 h-4">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="appearance-none w-4 h-4 border border-outline-variant rounded bg-surface-container-low checked:bg-primary checked:border-primary transition-colors cursor-pointer peer"
                  />
                  <span className="text-[12px] font-bold text-on-primary absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">✓</span>
                </div>
                <span className="font-body text-body text-on-surface-variant group-hover:text-on-surface transition-colors">Remember me for 30 days</span>
              </label>
            </>
          ) : (
            <div className="flex flex-col gap-sm">
              <label className="font-status text-status text-on-surface">AUTHENTICATOR CODE</label>
              <input 
                type="text" 
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input tracking-widest text-center text-lg"
                placeholder="123456"
                required 
              />
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-on-primary py-sm rounded-lg font-button-label text-button-label btn-interact transition-all hover:bg-inverse-surface disabled:opacity-50 disabled:cursor-not-allowed mt-md"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        
        <p className="font-body text-body text-on-surface-variant text-center">
          Don&apos;t have an account? <Link href="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
