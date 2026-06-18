import React from "react";

const ZONES = ["spawn", "bar", "lounge", "event", "arcade", "staff"];

export function Dock({ onNavigate }: { onNavigate: (zone: string) => void }) {
  return (
    <div className="dock">
      {ZONES.map(z => (
        <button key={z} onClick={() => onNavigate(z)}>{z}</button>
      ))}
    </div>
  );
}
