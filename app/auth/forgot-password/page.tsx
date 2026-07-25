"use client";

import { useState } from "react";
import Link from "next/link";
import { CaptchaWidget } from "@/components/captcha-widget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      setError("Please complete the CAPTCHA");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || "Failed to request password reset");
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
          <h1 className="font-display text-[28px] font-bold text-on-surface mb-xs tracking-tight">Reset Password</h1>
          <p className="font-body text-body text-on-surface-variant">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          {error && (
            <div className="bg-error-container text-error px-md py-sm rounded-lg font-body text-caption border border-error/20 flex items-center gap-sm">
              <span className="font-bold text-[16px]">!</span>
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-900/30 text-emerald-400 px-md py-sm rounded-lg font-body text-caption border border-emerald-500/20 flex items-center gap-sm">
              <span className="text-success font-bold text-[16px]">✓</span>
              {message}
            </div>
          )}
          
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

          <CaptchaWidget onVerify={(token) => setCaptchaToken(token)} />
          
          <button 
            type="submit" 
            disabled={isLoading || !captchaToken}
            className="w-full bg-primary text-on-primary py-sm rounded-lg font-button-label text-button-label btn-interact transition-all hover:bg-inverse-surface disabled:opacity-50 disabled:cursor-not-allowed mt-md"
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        
        <p className="font-body text-body text-on-surface-variant text-center">
          Remembered your password? <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
