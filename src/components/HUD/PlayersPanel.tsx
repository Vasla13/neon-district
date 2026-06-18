import React from "react";
import type { Player } from "../../types/game";
import { ROLE_CSS } from "../../utils/constants";

interface Props {
  players: Player[];
  onClose: () => void;
}

export function PlayersPanel({ players, onClose }: Props) {
  return (
    <div className="panel">
      <div className="panel-header"><strong>Reseau</strong><button onClick={onClose}>✕</button></div>
      {players.map(p => (
        <div key={p.id} className="player-row">
          <span className={`avatar-dot ${p.avatar}`} />
          <div><strong>{p.pseudo}</strong><br /><small>{p.title} • Niv.{p.level}</small></div>
          <small className={ROLE_CSS[p.role]}>{p.role}</small>
        </div>
      ))}
    </div>
  );
}
