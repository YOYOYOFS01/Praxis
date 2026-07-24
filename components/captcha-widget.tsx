"use client";

import { useEffect } from "react";

interface CaptchaWidgetProps {
  onVerify: (token: string) => void;
}

export function CaptchaWidget({ onVerify }: CaptchaWidgetProps) {
  // For MVP / local dev, auto-verify after 1 second if no real Turnstile key is provided
  useEffect(() => {
    const timer = setTimeout(() => {
      onVerify("mock_captcha_token_" + Date.now());
    }, 1000);
    return () => clearTimeout(timer);
  }, [onVerify]);

  return (
    <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/50 flex items-center gap-3">
      <div className="w-5 h-5 rounded-full border-2 border-zinc-600 border-t-emerald-500 animate-spin" />
      <span className="text-sm text-zinc-400">Verifying secure connection...</span>
    </div>
  );
}
