"use client";

import { useState } from "react";

interface Props {
  onSubmit: (prompt: string) => void;
  loading: boolean;
}

const EXAMPLES = [
  "Order 2 Dell XPS 15 from TechVendor Inc for the dev team",
  "Purchase 5 MacBook Pro M3 from Apple Business Store",
  "Buy 500 gaming chairs from UnknownVendor LLC",
];

export function ChatPanel({ onSubmit, loading }: Props) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    onSubmit(prompt.trim());
    setPrompt("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Label */}
      <p style={{
        fontSize: "10px",
        fontWeight: 700,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.18em",
      }}>
        Procurement Prompt
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to purchase…"
          rows={4}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--text)",
            padding: "11px 13px",
            fontSize: "13px",
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
            lineHeight: 1.6,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.04)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          style={{
            background: loading || !prompt.trim()
              ? "var(--surface-3)"
              : "var(--orange)",
            color: loading || !prompt.trim()
              ? "var(--text-muted)"
              : "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "10px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
            transition: "background 0.15s, transform 0.1s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            letterSpacing: "-0.01em",
          }}
          onMouseDown={(e) => {
            if (!loading && prompt.trim()) e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {loading ? (
            <>
              <span style={{ animation: "spin 0.9s linear infinite", display: "inline-block" }}>◌</span>
              Running…
            </>
          ) : (
            <>Run Procurement →</>
          )}
        </button>
      </form>

      {/* Examples */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p style={{
          fontSize: "10px",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
        }}>
          Examples
        </p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setPrompt(ex)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text-2)",
              padding: "7px 10px",
              fontSize: "11.5px",
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s, color 0.15s",
              lineHeight: 1.5,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.background = "var(--surface-2)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-2)";
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
