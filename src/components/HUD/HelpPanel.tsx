import React from "react";

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel" style={{ maxHeight: 380 }}>
      <div className="panel-header"><strong>Guide</strong><button onClick={onClose}>✕</button></div>
      <div className="help-content">
        <strong>Commandes</strong>
        <ul>
          <li><code>/wave</code> <code>/dance</code> <code>/hack</code> <code>/chill</code> <code>/glitch</code> — Emotes</li>
          <li><code>/scan</code> — Scanner ta zone</li>
          <li><code>/talk NOM</code> — Parler a un NPC (VOLT, NYX, ECHO)</li>
        </ul>
        <strong>Gameplay</strong>
        <ul>
          <li>Clique sur une case du sol pour te deplacer (pathfinding)</li>
          <li>Complete les protocoles pour XP + badges</li>
          <li>Explore les zones pour progresser</li>
          <li>Clique sur une Arcade pour le mini-jeu</li>
          <li>Dock en bas = teleportation rapide</li>
        </ul>
        <strong>Progression</strong>
        <p>New User → Runner → Specialise → Sentinel → Architect</p>
      </div>
    </div>
  );
}
