import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, Socket } from "socket.io-client";
import { createGame, DistrictScene } from "./phaser/createGame";
import "./styles.css";

type Role = "New User" | "Runner" | "Hacker" | "Architect" | "DJ" | "Sentinel" | "Ghost" | "Admin" | "Founder";
type Avatar = "runner" | "hacker" | "ghost" | "dj";

type Player = {
  id: string;
  pseudo: string;
  avatar: Avatar;
  role: Role;
  level: number;
  xp: number;
  badges: string[];
  title: string;
  status: string;
  x: number;
  y: number;
};

type ChatMessage = {
  id: string;
  pseudo: string;
  role: Role;
  text: string;
  at: number;
};

type WorldState = {
  year: 2042;
  event: {
    name: string;
    active: boolean;
    until: number;
    description: string;
  };
  online: Player[];
  chatLog: ChatMessage[];
};

type Session = {
  pseudo: string;
  avatar: Avatar;
  token: string;
};

const roleClass: Record<Role, string> = {
  "New User": "role-new",
  Runner: "role-runner",
  Hacker: "role-hacker",
  Architect: "role-architect",
  DJ: "role-dj",
  Sentinel: "role-sentinel",
  Ghost: "role-ghost",
  Admin: "role-admin",
  Founder: "role-founder"
};

const missions = [
  {
    id: "signal-lost",
    title: "PROTOCOLE 01 - SIGNAL PERDU",
    body: "Trouve le terminal glitche cache dans le lobby et recupere le code perdu.",
    reward: "+100 XP / Badge Signal Hunter"
  },
  {
    id: "fragment-404",
    title: "PROTOCOLE 02 - FRAGMENT 404",
    body: "Parle a trois joueurs et scanne le secteur Arcade.",
    reward: "+80 XP / Titre temporaire"
  },
  {
    id: "ghost-trace",
    title: "PROTOCOLE 04 - TRACE FANTOME",
    body: "Repere un symbole violet pendant un event GLITCH ALERT.",
    reward: "Badge rare Ghost Trace"
  }
];

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem("neon-session");
    return saved ? (JSON.parse(saved) as Session) : null;
  });
  const [world, setWorld] = useState<WorldState | null>(null);
  const [selectedMission, setSelectedMission] = useState(missions[0]);
  const [chatText, setChatText] = useState("");
  const [panel, setPanel] = useState<"missions" | "players" | "admin" | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sceneRef = useRef<DistrictScene | null>(null);

  const me = useMemo(() => {
    if (!session || !world) return null;
    return world.online.find((player) => player.pseudo === session.pseudo) ?? null;
  }, [session, world]);

  useEffect(() => {
    if (!session) return;
    const socket = io("/", { auth: { pseudo: session.pseudo, avatar: session.avatar, token: session.token } });
    socketRef.current = socket;

    socket.on("world", (nextWorld: WorldState) => {
      setWorld(nextWorld);
      sceneRef.current?.syncWorld(nextWorld.online, session.pseudo);
    });

    socket.on("chat", (message: ChatMessage) => {
      setWorld((current) => {
        if (!current) return current;
        return { ...current, chatLog: [...current.chatLog.slice(-39), message] };
      });
      sceneRef.current?.showSpeech(message.pseudo, message.text);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const game = createGame("game-root", {
      onReady: (scene) => {
        sceneRef.current = scene;
        if (world) scene.syncWorld(world.online, session.pseudo);
      },
      onMove: (x, y) => socketRef.current?.emit("move", { x, y }),
      onTerminal: () => {
        socketRef.current?.emit("mission:complete", "signal-lost");
        setPanel("missions");
      }
    });

    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [session]);

  function sendChat(event: React.FormEvent) {
    event.preventDefault();
    const clean = chatText.trim();
    if (!clean) return;
    socketRef.current?.emit("chat", clean);
    setChatText("");
  }

  function launchEvent() {
    socketRef.current?.emit("admin:event", "GLITCH ALERT");
  }

  if (!session) {
    return <AccessScreen onSession={setSession} />;
  }

  return (
    <main className="shell">
      <div className="scanlines" />
      <section className="game-shell">
        <div id="game-root" />
        <div className="client-topbar" aria-label="Statut Neon District">
          <div className="brand">
            <span className="brand-mark">2042</span>
            <div>
              <strong>NEON DISTRICT</strong>
              <span>{world?.event.active ? world.event.name : "SIGNAL STABLE"} / {world?.online.length ?? 0} online</span>
            </div>
          </div>
          <span className="signal-dot" />
          <div className="status-strip">
            <span>YEAR 2042</span>
            <span>PRIVATE CYBERWORLD</span>
          </div>
        </div>

        <aside className="left-hud game-panel">
          <ProfileCard player={me} fallback={session} />
          <nav className="tabs" aria-label="Panneaux du district">
            <button className={panel === "missions" ? "active" : ""} onClick={() => setPanel(panel === "missions" ? null : "missions")}>Protocoles</button>
            <button className={panel === "players" ? "active" : ""} onClick={() => setPanel(panel === "players" ? null : "players")}>Reseau</button>
            <button className={panel === "admin" ? "active" : ""} onClick={() => setPanel(panel === "admin" ? null : "admin")}>Admin</button>
          </nav>
          {panel === "missions" && (
            <div className="hud-panel">
              <PanelHeader title="Protocoles" onClose={() => setPanel(null)} />
              {missions.map((mission) => (
                <button key={mission.id} className={`mission ${selectedMission.id === mission.id ? "active" : ""}`} onClick={() => setSelectedMission(mission)}>
                  <span>{mission.title}</span>
                  <small>{mission.reward}</small>
                </button>
              ))}
              <div className="mission-detail">
                <strong>{selectedMission.title}</strong>
                <p>{selectedMission.body}</p>
                <button onClick={() => socketRef.current?.emit("mission:complete", selectedMission.id)}>Valider signal</button>
              </div>
            </div>
          )}
          {panel === "players" && <PlayersPanel players={world?.online ?? []} onClose={() => setPanel(null)} />}
          {panel === "admin" && <AdminPanel isAdmin={me?.role === "Founder" || me?.role === "Admin"} onLaunch={launchEvent} onClose={() => setPanel(null)} />}
        </aside>

        <aside className="right-hud game-panel">
          <div className="hud-panel event-panel">
            <span className="event-kicker">Event live</span>
            <strong>{world?.event.name ?? "GLITCH ALERT"}</strong>
            <small>{world?.event.description ?? "Symboles instables detectes dans le District."}</small>
          </div>
          <div className="chat">
            <div className="chat-head">
              <strong>District Chat</strong>
              <span>{world?.online.length ?? 0} signals</span>
            </div>
            <div className="chat-log">
              {(world?.chatLog ?? []).map((message) => (
                <p key={message.id}>
                  <span className={roleClass[message.role]}>{message.pseudo}</span>
                  {message.text}
                </p>
              ))}
            </div>
            <form onSubmit={sendChat}>
              <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="/wave  Signal detecte..." maxLength={160} />
              <button type="submit">Envoyer</button>
            </form>
          </div>
        </aside>
        <div className="bottom-dock">
          <span>Spawn</span>
          <span>Chill</span>
          <span>Protocoles</span>
          <span>Event</span>
          <span>Arcade</span>
          <span>Staff</span>
        </div>
      </section>
    </main>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="panel-head">
      <strong>{title}</strong>
      <button aria-label={`Fermer ${title}`} onClick={onClose}>x</button>
    </div>
  );
}

function AccessScreen({ onSession }: { onSession: (session: Session) => void }) {
  const [pseudo, setPseudo] = useState("");
  const [inviteCode, setInviteCode] = useState("2042");
  const [avatar, setAvatar] = useState<Avatar>("runner");
  const [error, setError] = useState("");

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo, inviteCode, avatar })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Connexion refusee.");
      return;
    }
    const nextSession = { pseudo: data.player.pseudo, avatar, token: data.token };
    localStorage.setItem("neon-session", JSON.stringify(nextSession));
    onSession(nextSession);
  }

  return (
    <main className="access">
      <div className="scanlines" />
      <section className="access-copy">
        <div className="access-logo">
          <span className="side-line" />
          <strong>2042</strong>
        </div>
        <span className="kicker">NEON DISTRICT ACCESS NODE</span>
        <h1>CYBERWORLD</h1>
        <p>Entre dans le lobby, choisis ton avatar, parle aux autres et lance les protocoles du District.</p>
      </section>
      <form className="access-card" onSubmit={register}>
        <strong className="login-title">Connexion au District</strong>
        <label>
          Pseudo unique
          <input value={pseudo} onChange={(event) => setPseudo(event.target.value)} placeholder="ex: Founder" maxLength={14} />
        </label>
        <label>
          Code d'invitation
          <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="NEON-2042" />
        </label>
        <div className="avatar-grid">
          {(["runner", "hacker", "ghost", "dj"] as Avatar[]).map((name) => (
            <button key={name} type="button" className={avatar === name ? "active" : ""} onClick={() => setAvatar(name)}>
              <span className={`avatar-chip ${name}`} />
              {name}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">Entrer dans le District</button>
      </form>
    </main>
  );
}

function ProfileCard({ player, fallback }: { player: Player | null; fallback: Session }) {
  return (
    <div className="profile">
      <span className={`avatar-chip ${player?.avatar ?? fallback.avatar}`} />
      <div>
        <div className="profile-line">
          <strong>{player?.pseudo ?? fallback.pseudo}</strong>
          <span className={player ? roleClass[player.role] : "role-new"}>{player?.role ?? "New User"}</span>
        </div>
        <small>{player?.title ?? "New Signal"}</small>
        <meter min={0} max={500} value={player?.xp ?? 0} />
        <small>Niveau {player?.level ?? 1} - XP {player?.xp ?? 0}</small>
      </div>
    </div>
  );
}

function PlayersPanel({ players, onClose }: { players: Player[]; onClose: () => void }) {
  return (
    <div className="hud-panel player-list">
      <PanelHeader title="Reseau" onClose={onClose} />
      {players.map((player) => (
        <div key={player.id}>
          <span className={`avatar-chip ${player.avatar}`} />
          <strong>{player.pseudo}</strong>
          <small className={roleClass[player.role]}>{player.role}</small>
        </div>
      ))}
    </div>
  );
}

function AdminPanel({ isAdmin, onLaunch, onClose }: { isAdmin: boolean; onLaunch: () => void; onClose: () => void }) {
  return (
    <div className="hud-panel admin-panel">
      <PanelHeader title="Terminal Staff" onClose={onClose} />
      <p>{isAdmin ? "Controle admin disponible." : "Acces reserve aux Admins et Founders."}</p>
      <button disabled={!isAdmin} onClick={onLaunch}>Lancer GLITCH ALERT</button>
      <button disabled>Annonce globale</button>
      <button disabled>Mute / Kick / Ban</button>
      <button disabled>Logs complets</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
