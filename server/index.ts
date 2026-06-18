import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

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
  muted?: boolean;
};

type ChatMessage = {
  id: string;
  pseudo: string;
  role: Role;
  text: string;
  at: number;
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }
});

app.use(express.json());

const inviteCodes = new Set(["2042", "NEON-2042", "DISTRICT"]);
const players = new Map<string, Player>();
const chatLog: ChatMessage[] = [];
let activeEvent = {
  name: "GLITCH ALERT",
  active: true,
  until: Date.now() + 30 * 60 * 1000,
  description: "Fragments instables detectes dans les secteurs Arcade et Est."
};

const systemPlayers: Player[] = [
  { id: "bot-a", pseudo: "VOLT", avatar: "runner", role: "Runner", level: 10, xp: 1020, badges: ["Signal Hunter"], title: "Insider", status: "Cherche Fragment 404", x: 742, y: 426 },
  { id: "bot-b", pseudo: "NYX", avatar: "hacker", role: "Hacker", level: 20, xp: 2240, badges: ["Code Breaker"], title: "Ghost Trace", status: "Terminal ouvert", x: 345, y: 545 },
  { id: "bot-c", pseudo: "ECHO", avatar: "ghost", role: "Ghost", level: 30, xp: 3600, badges: ["Glitch Survivor"], title: "District Agent", status: "Le reseau observe", x: 978, y: 566 }
];

app.post("/api/register", (req, res) => {
  const { pseudo, inviteCode, avatar } = req.body as { pseudo?: string; inviteCode?: string; avatar?: Avatar };
  const cleanPseudo = pseudo?.trim().slice(0, 14);

  if (!inviteCode || !inviteCodes.has(inviteCode.trim().toUpperCase())) {
    return res.status(403).json({ error: "Code d'invitation invalide." });
  }

  if (!cleanPseudo || cleanPseudo.length < 3) {
    return res.status(400).json({ error: "Pseudo trop court." });
  }

  const taken = [...players.values(), ...systemPlayers].some((player) => player.pseudo.toLowerCase() === cleanPseudo.toLowerCase());
  if (taken) {
    return res.status(409).json({ error: "Pseudo deja utilise." });
  }

  res.json({
    token: Buffer.from(`${cleanPseudo}:${Date.now()}`).toString("base64url"),
    player: createPlayer("pending", cleanPseudo, avatar ?? "runner")
  });
});

app.get("/api/state", (_req, res) => {
  res.json({
    year: 2042,
    event: activeEvent,
    online: [...players.values(), ...systemPlayers],
    chatLog: chatLog.slice(-40)
  });
});

io.use((socket, next) => {
  const pseudo = String(socket.handshake.auth?.pseudo ?? "").trim().slice(0, 14);
  const avatar = String(socket.handshake.auth?.avatar ?? "runner") as Avatar;
  if (!pseudo || pseudo.length < 3) return next(new Error("Pseudo invalide"));
  socket.data.pseudo = pseudo;
  socket.data.avatar = avatar;
  next();
});

io.on("connection", (socket) => {
  const player = createPlayer(socket.id, socket.data.pseudo, socket.data.avatar);
  players.set(socket.id, player);
  emitWorld();
  emitSystem(`${player.pseudo} vient d'entrer dans le District.`);

  socket.on("move", (position: { x: number; y: number }) => {
    const current = players.get(socket.id);
    if (!current) return;
    current.x = clamp(Number(position.x), 150, 1130);
    current.y = clamp(Number(position.y), 210, 650);
    emitWorld();
  });

  socket.on("chat", (text: string) => {
    const current = players.get(socket.id);
    if (!current || current.muted) return;
    const clean = String(text).trim().slice(0, 160);
    if (!clean) return;
    const message: ChatMessage = { id: crypto.randomUUID(), pseudo: current.pseudo, role: current.role, text: clean, at: Date.now() };
    chatLog.push(message);
    io.emit("chat", message);
  });

  socket.on("mission:complete", (missionId: string) => {
    const current = players.get(socket.id);
    if (!current) return;
    if (missionId === "signal-lost" && !current.badges.includes("Signal Hunter")) {
      current.xp += 100;
      current.level = levelFromXp(current.xp);
      current.badges.push("Signal Hunter");
      current.title = "Signal Hunter";
      emitSystem(`${current.pseudo} a recupere un fragment perdu.`);
      emitWorld();
    }
  });

  socket.on("admin:event", (eventName: string) => {
    const current = players.get(socket.id);
    if (!current || !["Admin", "Founder"].includes(current.role)) return;
    activeEvent = {
      name: String(eventName).trim().slice(0, 32) || "ANOMALIE DU DISTRICT",
      active: true,
      until: Date.now() + 30 * 60 * 1000,
      description: "Evenement manuel lance depuis le terminal admin."
    };
    emitSystem(`Event en cours : ${activeEvent.name}.`);
    emitWorld();
  });

  socket.on("disconnect", () => {
    const current = players.get(socket.id);
    players.delete(socket.id);
    if (current) emitSystem(`${current.pseudo} a quitte le District.`);
    emitWorld();
  });
});

function createPlayer(id: string, pseudo: string, avatar: Avatar): Player {
  const role: Role = pseudo.toLowerCase() === "founder" || pseudo.toLowerCase() === "admin" ? "Founder" : "New User";
  return {
    id,
    pseudo,
    avatar,
    role,
    level: 1,
    xp: 0,
    badges: [],
    title: "New Signal",
    status: "Connexion au district...",
    x: 610 + Math.random() * 90,
    y: 315 + Math.random() * 58
  };
}

function emitSystem(text: string) {
  const message: ChatMessage = { id: crypto.randomUUID(), pseudo: "SYSTEM 2042", role: "Sentinel", text, at: Date.now() };
  chatLog.push(message);
  io.emit("chat", message);
}

function emitWorld() {
  io.emit("world", {
    year: 2042,
    event: activeEvent,
    online: [...players.values(), ...systemPlayers],
    chatLog: chatLog.slice(-40)
  });
}

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

const port = Number(process.env.PORT ?? 3042);
httpServer.listen(port, "127.0.0.1", () => {
  console.log(`NEON DISTRICT server online on http://127.0.0.1:${port}`);
});
