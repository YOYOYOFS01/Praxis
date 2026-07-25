"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CaptchaWidget } from "@/components/captcha-widget";

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, newPassword: password, captchaToken }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to reset password");
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
          <h1 className="font-display text-[28px] font-bold text-on-surface mb-xs tracking-tight">Set New Password</h1>
          <p className="font-body text-body text-on-surface-variant">Enter your new secure password</p>
        </div>

        {success ? (
          <div className="text-center py-xl flex flex-col gap-md items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-sm">
              <span className="text-success font-bold text-[24px]">✓</span>
            </div>
            <h2 className="font-bold text-on-surface text-lg">Password Reset Successfully</h2>
            <p className="text-on-surface-variant text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
            {error && (
              <div className="bg-error-container text-error px-md py-sm rounded-lg font-body text-caption border border-error/20 flex items-center gap-sm">
                <span className="font-bold text-[16px]">!</span>
                {error}
              </div>
            )}
            
            <div className="flex flex-col gap-sm">
              <label className="font-status text-status text-on-surface">NEW PASSWORD</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
                placeholder="••••••••"
                required 
              />
            </div>
            
            <div className="flex flex-col gap-sm">
              <label className="font-status text-status text-on-surface">CONFIRM NEW PASSWORD</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
                placeholder="••••••••"
                required 
              />
            </div>

            <CaptchaWidget onVerify={(token) => setCaptchaToken(token)} />
            
            <button 
              type="submit" 
              disabled={isLoading || !captchaToken}
              className="w-full bg-primary text-on-primary py-sm rounded-lg font-button-label text-button-label btn-interact transition-all hover:bg-inverse-surface disabled:opacity-50 disabled:cursor-not-allowed mt-md"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
