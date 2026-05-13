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
    <div className={`card ${className}`} style={style}>
      <div className="card-header">
        <span className="t-heading">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
