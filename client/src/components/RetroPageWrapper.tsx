/* ============================================================
   RetroPageWrapper — Monthly-style pink dot title bar chrome
   Matches the calendar.exe / day_summary.txt style in Monthly.
   ============================================================ */

import React from "react";

interface RetroPageWrapperProps {
  title: string;
  sticker?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function RetroPageWrapper({ title, children, className = "", style }: RetroPageWrapperProps) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        borderRadius: 10,
        border: "1.5px solid oklch(0.78 0.08 330)",
        background: "oklch(0.975 0.018 355 / 0.95)",
        boxShadow: "3px 3px 0 oklch(0.72 0.08 310)",
        position: "relative",
        ...style,
      }}
    >
      {/* Pink dot title bar — matches Monthly style */}
      <div style={{
        background: "#F9D6E8",
        padding: "5px 10px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderBottom: "1.5px solid oklch(0.78 0.08 330)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(0.62 0.18 340)", boxShadow: "0 1px 0 oklch(0.40 0.18 340), inset 0 1px 1px rgba(255,255,255,0.55)" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(0.72 0.10 310)", boxShadow: "0 1px 0 oklch(0.50 0.10 310), inset 0 1px 1px rgba(255,255,255,0.55)" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(0.78 0.10 290)", boxShadow: "0 1px 0 oklch(0.55 0.10 290), inset 0 1px 1px rgba(255,255,255,0.55)" }} />
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#8A3060", marginLeft: 4 }}>{title}</span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
