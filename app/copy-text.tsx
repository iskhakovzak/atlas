"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyText({ text, children, className = "" }: { text: string; children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={`copy-text-btn ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      aria-label="Скопировать"
      title="Скопировать"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
      }}
    >
      {children ?? text}
      {copied ? <Check size={14} color="#668c3e" /> : <Copy size={12} style={{ opacity: 0.5 }} />}
    </button>
  );
}
