import React from "react";
import type { Player, Session } from "../../types/game";
import { ROLE_CSS } from "../../utils/constants";

interface Props {
  player: Player | null;
  session: Session;
}

export function ProfileCard({ player, session }: Props) {
  const xpNext = player ? Math.max(50, player.level * player.level * 50) : 50;
  const pct = Math.min(100, ((player?.xp ?? 0) / xpNext) * 100);
  const roleClass = player ? ROLE_CSS[player.role] : "role-new";

  return (
    <div className="profile-card">
      <span className={`avatar-dot ${player?.avatar ?? session.avatar}`} />
      <div className="profile-meta">
        <strong>{player?.pseudo ?? session.pseudo}<span className={`role-badge ${roleClass}`}>{player?.role ?? "New User"}</span></strong>
        <span className="title-text">{player?.title ?? "New Signal"}</span>
        <div className="xp-track"><div className="xp-track-fill" style={{ width: `${pct}%` }} /></div>
        <span className="profile-stats">Niv.{player?.level ?? 1} • {player?.xp ?? 0}/{xpNext} XP • {player?.badges?.length ?? 0} badges</span>
        {player?.zone && <span className="profile-zone">📍 {player.zone}</span>}
      </div>
    </div>
  );
}
