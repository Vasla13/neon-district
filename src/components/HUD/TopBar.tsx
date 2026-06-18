import React from "react";
import type { GameEvent } from "../../types/game";

interface Props {
  event: GameEvent | null;
  online: number;
  soundOn: boolean;
  onToggleSound: () => void;
  onLogout: () => void;
}

export function TopBar({ event, online, soundOn, onToggleSound, onLogout }: Props) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <span className="topbar-logo">2042</span>
        <div className="topbar-info">
          <strong>NEON DISTRICT</strong>
          <span>{event?.active ? event.name : "STABLE"} • {online} en ligne</span>
        </div>
      </div>
      <div className="topbar-status" />
      <div className="topbar-actions">
        <button onClick={onToggleSound}>{soundOn ? "🔊" : "🔇"}</button>
        <button onClick={onLogout}>⏻</button>
      </div>
    </div>
  );
}
