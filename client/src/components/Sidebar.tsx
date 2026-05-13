/* ============================================================
   Sidebar — Pure Minimal Design
   Desktop: 56px left sidebar
   Mobile: bottom tab bar
   ============================================================ */

import React from "react";
import { useMobile } from "@/hooks/useMobile";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onClearData?: () => void;
}

// Lucide-style SVG icons (strokeWidth 1.5, no fill)
const icons = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9"/><path d="M5 10v9h5v-5h4v5h5v-9"/>
    </svg>
  ),
  tasks: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  matrix: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>
    </svg>
  ),
  dump: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5-3.5 6.5V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.5C6.5 14 5 12 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/>
    </svg>
  ),
  monthly: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "dashboard", label: "HOME",    icon: icons.home     },
  { id: "dump",      label: "DUMP",    icon: icons.dump     },
  { id: "tasks",     label: "TASKS",   icon: icons.tasks    },
  { id: "matrix",    label: "MATRIX",  icon: icons.matrix   },
  { id: "monthly",   label: "MONTHLY", icon: icons.monthly  },
  { id: "settings",  label: "SET",     icon: icons.settings },
];

export function TimerPill({ onGoToFocus }: { onGoToFocus: () => void }) {
  return null; // Simplified - timer pill not needed
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const isMobile = useMobile();

  if (isMobile) {
    return (
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              className={`bottom-nav-item ${active ? "active" : ""}`}
              onClick={() => onSectionChange(id)}
              title={label}
            >
              <span style={{ color: active ? "#111111" : "#BBBBBB", display: "flex" }}>
                {icon}
              </span>
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className="desktop-sidebar">
      {/* Logo mark */}
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>
        </svg>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, width: "100%", padding: "0 8px" }}>
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              className={`sidebar-item ${active ? "active" : ""}`}
              onClick={() => onSectionChange(id)}
              title={label}
            >
              <span style={{ color: active ? "#111111" : "#BBBBBB", display: "flex" }}>
                {icon}
              </span>
              <span className="sidebar-label">{label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
