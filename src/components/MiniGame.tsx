import React, { useEffect, useRef, useState } from "react";
import { audio } from "../hooks/useAudio";

interface Props {
  onClose: () => void;
  onShare: (score: number) => void;
}

export function MiniGame({ onClose, onShare }: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const state = useRef({ run: true, score: 0, py: 200, vy: 0, obs: [] as { x: number; h: number }[], frame: 0 });

  useEffect(() => {
    const c = cvs.current!;
    const ctx = c.getContext("2d")!;
    const g = state.current;
    g.run = true; g.score = 0; g.py = 200; g.vy = 0; g.obs = []; g.frame = 0;

    const jump = () => { if (g.py >= 232) g.vy = -10; };
    c.onclick = jump;
    const kh = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); jump(); } };
    window.addEventListener("keydown", kh);

    let af: number;
    const loop = () => {
      if (!g.run) return;
      ctx.fillStyle = "#030508";
      ctx.fillRect(0, 0, 480, 280);
      ctx.fillStyle = "#0c1a28";
      ctx.fillRect(0, 252, 480, 28);
      ctx.strokeStyle = "#4ff5ff";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 252); ctx.lineTo(480, 252); ctx.stroke();
      ctx.strokeStyle = "rgba(79,245,255,0.06)";
      for (let x = (g.frame * 3) % 40; x < 480; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 252); ctx.stroke(); }

      g.vy += 0.6;
      g.py += g.vy;
      if (g.py > 232) { g.py = 232; g.vy = 0; }
      ctx.fillStyle = "#4ff5ff";
      ctx.fillRect(50, g.py, 16, 24);
      ctx.shadowColor = "#4ff5ff"; ctx.shadowBlur = 8;
      ctx.fillRect(53, g.py + 3, 10, 18);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.fillRect(52, g.py + 6, 12, 3);

      g.frame++;
      const rate = Math.max(35, 60 - g.score);
      if (g.frame % rate === 0) g.obs.push({ x: 500, h: 28 + Math.random() * 36 });
      const speed = 3.5 + Math.min(g.score * 0.12, 4);
      ctx.fillStyle = "#ff55ef";
      for (let i = g.obs.length - 1; i >= 0; i--) {
        const o = g.obs[i];
        o.x -= speed;
        ctx.fillRect(o.x, 252 - o.h, 14, o.h);
        if (50 + 16 > o.x + 2 && 50 < o.x + 12 && g.py + 24 > 252 - o.h + 2) {
          g.run = false; setDead(true); setScore(g.score); audio.play("event"); return;
        }
        if (o.x < -20) { g.obs.splice(i, 1); g.score++; }
      }
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.fillText(`${g.score}`, 440, 20);
      ctx.fillStyle = "#4ff5ff"; ctx.font = "bold 9px monospace"; ctx.fillText("NEON RUNNER", 10, 16);
      af = requestAnimationFrame(loop);
    };
    af = requestAnimationFrame(loop);
    return () => { g.run = false; cancelAnimationFrame(af); window.removeEventListener("keydown", kh); };
  }, []);

  return (
    <div className="minigame-overlay">
      <div className="minigame-modal">
        <header><strong>🎮 NEON RUNNER</strong><button onClick={onClose}>✕</button></header>
        <canvas ref={cvs} width={480} height={280} />
        <p className="hint">Clique / Espace = Sauter</p>
        {dead && <div className="minigame-result"><strong>GAME OVER</strong><span>Score: {score}</span><button className="btn-primary" onClick={() => onShare(score)}>Partager</button><button onClick={onClose}>Fermer</button></div>}
      </div>
    </div>
  );
}
