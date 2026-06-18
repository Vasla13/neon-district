import React, { useState } from "react";

interface Props {
  isAdmin: boolean;
  onEvent: (name: string) => void;
  onAnnounce: (text: string) => void;
  onMute: (pseudo: string) => void;
  onClose: () => void;
}

export function AdminPanel({ isAdmin, onEvent, onAnnounce, onMute, onClose }: Props) {
  const [txt, setTxt] = useState("");

  return (
    <div className="panel">
      <div className="panel-header"><strong>Staff Terminal</strong><button onClick={onClose}>✕</button></div>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>{isAdmin ? "Acces admin actif." : "Acces reserve."}</p>
      <button disabled={!isAdmin} onClick={() => onEvent("GLITCH ALERT")}>Lancer Event</button>
      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, marginTop: 6 }}>
          <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Annonce..." maxLength={200} />
          <button onClick={() => { onAnnounce(txt); setTxt(""); }}>OK</button>
        </div>
      )}
      <button disabled={!isAdmin} onClick={() => { const t = prompt("Pseudo:"); if (t) onMute(t); }}>Mute</button>
    </div>
  );
}
