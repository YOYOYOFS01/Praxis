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
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Procurement Prompt
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to purchase…"
          rows={4}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            padding: "10px 12px",
            fontSize: "13px",
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
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
            background: loading ? "var(--surface-2)" : "var(--orange)",
            color: loading ? "var(--text-muted)" : "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "Running…" : "Run Procurement →"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Examples</p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setPrompt(ex)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-muted)",
              padding: "5px 8px",
              fontSize: "11px",
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#444")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
