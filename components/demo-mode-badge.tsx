"use client";

import { useState, useEffect } from "react";

export function DemoModeBadge() {
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("praxis_mock_mode");
    if (saved !== null) {
      setIsDemo(saved === "true");
    } else {
      setIsDemo(true);
    }
  }, []);

  const toggleMode = () => {
    const next = !isDemo;
    setIsDemo(next);
    localStorage.setItem("praxis_mock_mode", String(next));
    window.dispatchEvent(new Event("praxis_mock_mode_changed"));
  };

  const color = isDemo ? "var(--yellow, #d4a840)" : "var(--teal, #00f5d4)";
  const fill = isDemo ? "rgba(212, 168, 64, 0.15)" : "rgba(0, 245, 212, 0.15)";
  const label = isDemo ? "DEMO (INSTANT MOCK)" : "LIVE LLM MODE";

  return (
    <button
      onClick={toggleMode}
      title="Click to toggle between Instant Demo Mode and Live OpenAI LLM Mode"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color,
        background: fill,
        border: `1px solid ${color}`,
        borderRadius: "20px",
        padding: "4px 12px",
        textTransform: "uppercase",
        fontFamily: "'JetBrains Mono', monospace",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: isDemo ? "0 0 10px rgba(212, 168, 64, 0.2)" : "0 0 10px rgba(0, 245, 212, 0.2)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {label} ⇌
    </button>
  );
}
