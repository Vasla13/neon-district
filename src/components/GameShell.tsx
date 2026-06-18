import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Session, WorldState, Notification, Player } from "../types/game";
import { MISSIONS } from "../utils/constants";
import { createGame, DistrictScene } from "../phaser";
import { useSocket } from "../hooks/useSocket";
import { audio } from "../hooks/useAudio";
import { TopBar } from "./HUD/TopBar";
import { ProfileCard } from "./HUD/ProfileCard";
import { MissionsPanel } from "./HUD/MissionsPanel";
import { PlayersPanel } from "./HUD/PlayersPanel";
import { AdminPanel } from "./HUD/AdminPanel";
import { HelpPanel } from "./HUD/HelpPanel";
import { ChatBox } from "./HUD/ChatBox";
import { EventWidget } from "./HUD/EventWidget";
import { Dock } from "./HUD/Dock";
import { Notifications } from "./Notifications";
import { MiniGame } from "./MiniGame";

interface Props {
  session: Session;
  onLogout: () => void;
}

export function GameShell({ session, onLogout }: Props) {
  const sceneRef = useRef<DistrictScene | null>(null);
  const [panel, setPanel] = useState<"missions" | "players" | "admin" | "help" | null>(null);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [miniGame, setMiniGame] = useState(false);
  const [selMission, setSelMission] = useState(MISSIONS[0]);
  const prevXp = useRef(0);

  const addNotification = useCallback((type: string, title: string, body: string) => {
    const n: Notification = { id: crypto.randomUUID(), type, title, body };
    setNotifs(prev => [...prev.slice(-4), n]);
    setTimeout(() => setNotifs(prev => prev.filter(x => x.id !== n.id)), 4000);
  }, []);

  const { world, sendChat, sendMove, completeMission, adminEvent, adminAnnounce, adminMute, terminalInteract } = useSocket(session, sceneRef, addNotification);

  const me: Player | null = world?.online.find(p => p.pseudo === session.pseudo) ?? null;

  // XP notification
  useEffect(() => {
    if (me && me.xp > prevXp.current && prevXp.current > 0) {
      addNotification("xp", `+${me.xp - prevXp.current} XP`, `Niveau ${me.level}`);
      audio.play("achievement");
      sceneRef.current?.triggerAchievementEffect(me.x, me.y);
    }
    if (me) prevXp.current = me.xp;
  }, [me?.xp]);

  // Phaser game
  useEffect(() => {
    const game = createGame("game-canvas", {
      onReady: (scene) => {
        sceneRef.current = scene;
        if (world) scene.syncWorld(world.online, session.pseudo);
      },
      onMove: (x, y) => {
        sendMove(x, y);
        audio.play("click");
      },
      onTerminal: () => {
        terminalInteract();
        setPanel("missions");
        audio.play("terminal");
      },
      onArcade: () => {
        setMiniGame(true);
        audio.play("terminal");
      },
      onNpcClick: (name) => {
        sendChat(`/talk ${name}`);
        audio.play("notification");
      },
      onCollect: (_type, _value) => {
        audio.play("achievement");
      },
      onZoneEnter: (zone) => {
        addNotification("zone", `Zone: ${zone}`, "Secteur scanne");
        audio.play("step");
      },
      onFurnitureClick: (id) => {
        addNotification("scan", id, "Interaction");
        audio.play("click");
      },
    });

    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, []);

  function navigate(zone: string) {
    const coords: Record<string, { x: number; y: number }> = {
      spawn: { x: 640, y: 320 }, bar: { x: 320, y: 400 }, lounge: { x: 340, y: 500 },
      event: { x: 640, y: 480 }, arcade: { x: 860, y: 380 }, staff: { x: 860, y: 540 },
    };
    if (coords[zone]) { sendMove(coords[zone].x, coords[zone].y); audio.play("click"); }
  }

  return (
    <div className="game-shell">
      <div className="scanlines" />
      {miniGame && (
        <MiniGame
          onClose={() => setMiniGame(false)}
          onShare={score => { sendChat(`Score Arcade: ${score} 🎮`); setMiniGame(false); }}
        />
      )}

      <Notifications items={notifs} />

      <div id="game-canvas" />

      <TopBar
        event={world?.event ?? null}
        online={world?.online.length ?? 0}
        soundOn={soundOn}
        onToggleSound={() => { audio.toggle(); setSoundOn(!soundOn); }}
        onLogout={onLogout}
      />

      <div className="hud-left">
        <ProfileCard player={me} session={session} />
        <nav className="nav-tabs">
          <button className={panel === "missions" ? "active" : ""} onClick={() => setPanel(panel === "missions" ? null : "missions")}>Missions</button>
          <button className={panel === "players" ? "active" : ""} onClick={() => setPanel(panel === "players" ? null : "players")}>Reseau</button>
          <button className={panel === "admin" ? "active" : ""} onClick={() => setPanel(panel === "admin" ? null : "admin")}>Admin</button>
          <button className={panel === "help" ? "active" : ""} onClick={() => setPanel(panel === "help" ? null : "help")}>?</button>
        </nav>
        {panel === "missions" && <MissionsPanel selected={selMission} onSelect={setSelMission} completed={me?.completedMissions ?? []} onValidate={completeMission} onClose={() => setPanel(null)} />}
        {panel === "players" && <PlayersPanel players={world?.online ?? []} onClose={() => setPanel(null)} />}
        {panel === "admin" && <AdminPanel isAdmin={me?.role === "Founder" || me?.role === "Admin"} onEvent={adminEvent} onAnnounce={adminAnnounce} onMute={adminMute} onClose={() => setPanel(null)} />}
        {panel === "help" && <HelpPanel onClose={() => setPanel(null)} />}
      </div>

      <div className="hud-right">
        <EventWidget event={world?.event ?? null} />
        <ChatBox messages={world?.chatLog ?? []} online={world?.online.length ?? 0} onSend={sendChat} />
      </div>

      <Dock onNavigate={navigate} />
    </div>
  );
}
