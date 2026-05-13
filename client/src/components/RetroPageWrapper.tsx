/* ============================================================
   NoriPageWrapper — Nori design system card chrome
   Pure white card, hairline border, rounded corners
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
        borderRadius: 16,
        border: "1px solid oklch(0.88 0.005 20)",
        background: "oklch(1 0 0)",
        position: "relative",
        ...style,
      }}
    >
      {/* Nori section header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        background: "oklch(0.96 0.002 20)",
        borderBottom: "1px solid oklch(0.88 0.005 20)",
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Pretendard', system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "oklch(0.12 0.01 20)",
          letterSpacing: "0.01em",
        }}>{title}</span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
