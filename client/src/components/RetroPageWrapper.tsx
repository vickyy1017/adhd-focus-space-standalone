/* ============================================================
   MacPageWrapper — macOS-style card chrome for full pages
   Replaces the old retro Windows-style window chrome.
   Usage:
     <RetroPageWrapper title="Tasks" sticker="star">
       {children}
     </RetroPageWrapper>
   ============================================================ */

import React from "react";

/* macOS traffic-light dots */
function TrafficLights() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "oklch(0.72 0.18 25)", boxShadow: "inset 0 1px 1px oklch(0.88 0.12 25 / 0.6), 0 1px 2px oklch(0.52 0.20 25 / 0.4)" }} />
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "oklch(0.78 0.14 85)", boxShadow: "inset 0 1px 1px oklch(0.92 0.10 85 / 0.6), 0 1px 2px oklch(0.58 0.16 85 / 0.4)" }} />
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "oklch(0.72 0.14 160)", boxShadow: "inset 0 1px 1px oklch(0.88 0.10 160 / 0.6), 0 1px 2px oklch(0.52 0.16 160 / 0.4)" }} />
    </div>
  );
}

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
        borderRadius: 12,
        border: "1px solid oklch(0.84 0.040 340)",
        background: "oklch(0.975 0.018 355 / 0.95)",
        boxShadow: "0 2px 16px oklch(0.58 0.18 340 / 0.08), 0 1px 4px oklch(0.58 0.18 340 / 0.06)",
        position: "relative",
        ...style,
      }}
    >
      {/* macOS title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "oklch(0.945 0.030 355)",
          borderBottom: "1px solid oklch(0.84 0.040 340)",
          flexShrink: 0,
        }}
      >
        <TrafficLights />
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: "oklch(0.35 0.040 320)",
          letterSpacing: "0.01em",
          flex: 1,
          textAlign: "center",
          marginRight: 42, // balance the traffic lights
        }}>
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
