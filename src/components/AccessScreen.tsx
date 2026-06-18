import React, { useState } from "react";
import type { Session, Avatar } from "../types/game";
import { audio } from "../hooks/useAudio";

export function AccessScreen({ onSession }: { onSession: (s: Session) => void }) {
  const [pseudo, setPseudo] = useState("");
  const [code, setCode] = useState("2042");
  const [avatar, setAvatar] = useState<Avatar>("runner");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, inviteCode: code, avatar }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur de connexion."); return; }
      const session: Session = { pseudo: data.player.pseudo, avatar, token: data.token };
      localStorage.setItem("neon-session", JSON.stringify(session));
      audio.play("achievement");
      onSession(session);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="access">
      <div className="scanlines" />
      <section className="access-hero">
        <div className="logo-block">
          <div className="logo-line" />
          <span className="logo-year">2042</span>
        </div>
        <span className="tagline">NEON DISTRICT • ACCESS NODE</span>
        <h1>CYBERWORLD</h1>
        <p>Un monde cyberpunk multijoueur isometrique. Explore, parle aux NPCs, complete des missions, joue dans l'arcade.</p>
        <div className="features">
          <span>🗺️ Monde iso</span>
          <span>💬 Chat live</span>
          <span>🎮 Arcade</span>
          <span>🏆 Missions</span>
          <span>🤖 NPCs</span>
          <span>🌧️ Ambiance</span>
        </div>
      </section>
      <form className="access-card" onSubmit={submit}>
        <span className="card-title">Entrer dans le District</span>
        <label>Pseudo<input value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="NeoRunner" maxLength={14} /></label>
        <label>Code d'invitation<input value={code} onChange={e => setCode(e.target.value)} placeholder="NEON-2042" /></label>
        <label>Avatar</label>
        <div className="avatar-pick">
          {(["runner", "hacker", "ghost", "dj"] as Avatar[]).map(a => (
            <button key={a} type="button" className={avatar === a ? "active" : ""} onClick={() => { setAvatar(a); audio.play("click"); }}>
              <span className={`avatar-dot ${a}`} />
              {a}
            </button>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>{loading ? "..." : "Connexion"}</button>
      </form>
    </main>
  );
}
