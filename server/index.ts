import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import crypto from "node:crypto";

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
  zone: string;
  emote?: string;
  emoteUntil?: number;
  completedMissions: string[];
  interactions: number;
  scannedSectors: string[];
  lastActive: number;
};

type ChatMessage = {
  id: string;
  pseudo: string;
  role: Role;
  text: string;
  at: number;
  type?: "system" | "chat" | "emote" | "npc" | "achievement";
};

type GameEvent = {
  name: string;
  active: boolean;
  until: number;
  description: string;
  glitchSymbols: { x: number; y: number; found: boolean }[];
};

// --- Rate limiting ---
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRate(id: string, maxPerWindow: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(id);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxPerWindow) return false;
  entry.count++;
  return true;
}

// --- Token system ---
const TOKEN_SECRET = crypto.randomBytes(32).toString("hex");
const tokens = new Map<string, { pseudo: string; avatar: Avatar; createdAt: number }>();

function generateToken(pseudo: string, avatar: Avatar): string {
  const id = crypto.randomUUID();
  tokens.set(id, { pseudo, avatar, createdAt: Date.now() });
  return id;
}

function validateToken(token: string): { pseudo: string; avatar: Avatar } | null {
  return tokens.get(token) ?? null;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }
});

app.use(express.json());

const inviteCodes = new Set(["2042", "NEON-2042", "DISTRICT"]);
const players = new Map<string, Player>();
const chatLog: ChatMessage[] = [];

// --- Zones definition ---
const zones: Record<string, { x: number; y: number; radius: number; label: string }> = {
  spawn: { x: 640, y: 280, radius: 80, label: "Zone Spawn" },
  chill: { x: 360, y: 530, radius: 100, label: "Neon Bar" },
  arcade: { x: 780, y: 570, radius: 110, label: "Arcade" },
  event: { x: 640, y: 540, radius: 80, label: "Event Stage" },
  staff: { x: 1040, y: 530, radius: 90, label: "Staff Zone" },
  terminal: { x: 918, y: 440, radius: 50, label: "Terminal 404" },
  missions: { x: 820, y: 400, radius: 60, label: "Protocoles" },
};

function getZone(x: number, y: number): string {
  for (const [name, zone] of Object.entries(zones)) {
    const dx = x - zone.x;
    const dy = y - zone.y;
    if (Math.sqrt(dx * dx + dy * dy) <= zone.radius) return name;
  }
  return "lobby";
}

// --- Dynamic events ---
const eventPool = [
  { name: "GLITCH ALERT", description: "Fragments instables detectes dans les secteurs Arcade et Est." },
  { name: "NEON SURGE", description: "Surcharge electrique dans le reseau. Les terminaux emettent des signaux anormaux." },
  { name: "PHANTOM WAVE", description: "Des traces fantomes apparaissent dans le District. Ouvrez l'oeil." },
  { name: "DATA STORM", description: "Tempete de donnees. Les connexions sont instables mais les recompenses sont doubles." },
  { name: "SIGNAL NOIR", description: "Un signal inconnu brouille les communications. Trouvez sa source." },
];

function randomEvent(): GameEvent {
  const ev = eventPool[Math.floor(Math.random() * eventPool.length)];
  const symbols: GameEvent["glitchSymbols"] = [];
  for (let i = 0; i < 3; i++) {
    symbols.push({ x: 300 + Math.random() * 600, y: 300 + Math.random() * 300, found: false });
  }
  return {
    ...ev,
    active: true,
    until: Date.now() + 20 * 60 * 1000,
    glitchSymbols: symbols,
  };
}

let activeEvent: GameEvent = randomEvent();

// --- NPC bots ---
const systemPlayers: Player[] = [
  { id: "bot-a", pseudo: "VOLT", avatar: "runner", role: "Runner", level: 10, xp: 1020, badges: ["Signal Hunter"], title: "Insider", status: "Cherche Fragment 404", x: 742, y: 426, zone: "arcade", completedMissions: [], interactions: 0, scannedSectors: [], lastActive: Date.now() },
  { id: "bot-b", pseudo: "NYX", avatar: "hacker", role: "Hacker", level: 20, xp: 2240, badges: ["Code Breaker"], title: "Ghost Trace", status: "Terminal ouvert", x: 345, y: 545, zone: "chill", completedMissions: [], interactions: 0, scannedSectors: [], lastActive: Date.now() },
  { id: "bot-c", pseudo: "ECHO", avatar: "ghost", role: "Ghost", level: 30, xp: 3600, badges: ["Glitch Survivor"], title: "District Agent", status: "Le reseau observe", x: 978, y: 566, zone: "arcade", completedMissions: [], interactions: 0, scannedSectors: [], lastActive: Date.now() },
];

const npcDialogues: Record<string, string[]> = {
  VOLT: [
    "Yo ! T'as vu les fragments dans l'Arcade ? Ils brillent depuis le dernier GLITCH.",
    "Si tu cherches le terminal 404, il est au nord-est. Fais gaffe aux interferences.",
    "Moi je speed-run les protocoles. Record: 47 secondes. Bats ca.",
    "Le DJ a change le beat ce matin. L'ambiance est folle.",
    "T'es nouveau ? Bienvenue dans le District. Reste pas au spawn trop longtemps.",
  ],
  NYX: [
    "... Les firewalls sont faibles ce soir. Parfait pour scanner.",
    "J'ai cracke trois fragments aujourd'hui. Le code source du District est... interessant.",
    "Tu vois les lignes sur le sol ? C'est pas juste decoratif. C'est des data-streams.",
    "Le prochain event va etre massif. Je l'ai lu dans les logs.",
    "Parle pas trop fort. Les Sentinels ecoutent.",
  ],
  ECHO: [
    "...",
    "Je suis partout et nulle part. Le reseau me connait.",
    "Les Ghost Traces sont reelles. J'en ai vu une hier pres du terminal.",
    "Si tu veux progresser, complete les protocoles dans l'ordre.",
    "Le District cache des secrets. Regarde sous la surface.",
  ],
};

// --- Missions system ---
const missionDefinitions: Record<string, { xpReward: number; badge: string; title: string; requirements: string }> = {
  "signal-lost": { xpReward: 100, badge: "Signal Hunter", title: "Signal Hunter", requirements: "terminal" },
  "fragment-404": { xpReward: 80, badge: "Fragment Finder", title: "Data Runner", requirements: "interactions:3,scan:arcade" },
  "ghost-trace": { xpReward: 150, badge: "Ghost Trace", title: "Ghost Tracker", requirements: "event-symbol" },
  "neon-surge": { xpReward: 120, badge: "Neon Surfer", title: "Neon Surfer", requirements: "zones:4" },
  "code-breaker": { xpReward: 200, badge: "Code Breaker", title: "Code Breaker", requirements: "missions:3" },
};

function canCompleteMission(player: Player, missionId: string): boolean {
  if (player.completedMissions.includes(missionId)) return false;
  const def = missionDefinitions[missionId];
  if (!def) return false;

  const reqs = def.requirements.split(",");
  for (const req of reqs) {
    if (req === "terminal" && player.zone !== "terminal") return false;
    if (req.startsWith("interactions:")) {
      const needed = parseInt(req.split(":")[1]);
      if (player.interactions < needed) return false;
    }
    if (req.startsWith("scan:")) {
      const sector = req.split(":")[1];
      if (!player.scannedSectors.includes(sector)) return false;
    }
    if (req === "event-symbol") {
      if (!activeEvent.active) return false;
      const hasFound = activeEvent.glitchSymbols.some((s) => s.found);
      if (!hasFound) return false;
    }
    if (req.startsWith("zones:")) {
      const needed = parseInt(req.split(":")[1]);
      if (player.scannedSectors.length < needed) return false;
    }
    if (req.startsWith("missions:")) {
      const needed = parseInt(req.split(":")[1]);
      if (player.completedMissions.length < needed) return false;
    }
  }
  return true;
}

function completeMission(player: Player, missionId: string): boolean {
  if (!canCompleteMission(player, missionId)) return false;
  const def = missionDefinitions[missionId];
  player.xp += def.xpReward;
  player.level = levelFromXp(player.xp);
  if (!player.badges.includes(def.badge)) player.badges.push(def.badge);
  player.title = def.title;
  player.completedMissions.push(missionId);
  updateRole(player);
  return true;
}

function updateRole(player: Player) {
  if (player.role === "Founder" || player.role === "Admin") return;
  if (player.level >= 25) player.role = "Architect";
  else if (player.level >= 15) player.role = "Sentinel";
  else if (player.level >= 10) {
    if (player.avatar === "hacker") player.role = "Hacker";
    else if (player.avatar === "ghost") player.role = "Ghost";
    else if (player.avatar === "dj") player.role = "DJ";
    else player.role = "Runner";
  } else if (player.level >= 5) player.role = "Runner";
}

// --- Emote system ---
const emoteCommands: Record<string, string> = {
  "/wave": "wave",
  "/dance": "dance",
  "/hack": "hack",
  "/chill": "chill",
  "/salute": "salute",
  "/glitch": "glitch",
};

// --- API Routes ---
app.post("/api/register", (req, res) => {
  const { pseudo, inviteCode, avatar } = req.body as { pseudo?: string; inviteCode?: string; avatar?: Avatar };
  const cleanPseudo = pseudo?.trim().replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 14);

  if (!inviteCode || !inviteCodes.has(inviteCode.trim().toUpperCase())) {
    return res.status(403).json({ error: "Code d'invitation invalide." });
  }

  if (!cleanPseudo || cleanPseudo.length < 3) {
    return res.status(400).json({ error: "Pseudo trop court (min 3 caracteres alphanumeriques)." });
  }

  const validAvatars: Avatar[] = ["runner", "hacker", "ghost", "dj"];
  const cleanAvatar: Avatar = validAvatars.includes(avatar as Avatar) ? (avatar as Avatar) : "runner";

  const taken = [...players.values(), ...systemPlayers].some((player) => player.pseudo.toLowerCase() === cleanPseudo.toLowerCase());
  if (taken) {
    return res.status(409).json({ error: "Pseudo deja utilise." });
  }

  const token = generateToken(cleanPseudo, cleanAvatar);
  res.json({
    token,
    player: createPlayer("pending", cleanPseudo, cleanAvatar),
  });
});

app.get("/api/state", (_req, res) => {
  res.json({
    year: 2042,
    event: activeEvent,
    online: [...players.values(), ...systemPlayers],
    chatLog: chatLog.slice(-40),
  });
});

// --- Socket.io middleware ---
io.use((socket, next) => {
  const token = String(socket.handshake.auth?.token ?? "");
  const session = validateToken(token);
  if (!session) {
    const pseudo = String(socket.handshake.auth?.pseudo ?? "").trim().slice(0, 14);
    const avatar = String(socket.handshake.auth?.avatar ?? "runner") as Avatar;
    if (!pseudo || pseudo.length < 3) return next(new Error("Auth invalide"));
    socket.data.pseudo = pseudo;
    socket.data.avatar = avatar;
  } else {
    socket.data.pseudo = session.pseudo;
    socket.data.avatar = session.avatar;
  }
  next();
});

// --- Socket.io connections ---
io.on("connection", (socket) => {
  const player = createPlayer(socket.id, socket.data.pseudo, socket.data.avatar);
  players.set(socket.id, player);
  emitWorld();
  emitSystem(`${player.pseudo} vient d'entrer dans le District.`);

  // Send personal welcome
  socket.emit("notification", {
    type: "welcome",
    title: "Bienvenue dans le District",
    body: "Explore, parle aux NPCs, complete les protocoles. Tape /wave pour saluer !",
  });

  // --- Movement with throttle ---
  let lastMove = 0;
  socket.on("move", (position: { x: number; y: number }) => {
    const now = Date.now();
    if (now - lastMove < 50) return; // 20 moves/sec max
    lastMove = now;

    const current = players.get(socket.id);
    if (!current) return;
    current.x = clamp(Number(position.x), 150, 1130);
    current.y = clamp(Number(position.y), 210, 650);

    const newZone = getZone(current.x, current.y);
    if (newZone !== current.zone) {
      const oldZone = current.zone;
      current.zone = newZone;
      if (!current.scannedSectors.includes(newZone)) {
        current.scannedSectors.push(newZone);
        socket.emit("notification", { type: "zone", title: zones[newZone]?.label ?? newZone, body: `Secteur scanne ! (${current.scannedSectors.length} explores)` });
        // Check neon-surge mission
        if (current.scannedSectors.length >= 4 && !current.completedMissions.includes("neon-surge")) {
          socket.emit("notification", { type: "hint", title: "Protocole NEON SURGE", body: "Tu as explore assez de zones ! Valide le protocole." });
        }
      }
    }

    current.lastActive = now;
    emitWorld();
  });

  // --- Chat with commands ---
  socket.on("chat", (text: string) => {
    const current = players.get(socket.id);
    if (!current || current.muted) return;
    if (!checkRate(`chat:${socket.id}`, 8, 10000)) {
      socket.emit("notification", { type: "warning", title: "Slow down", body: "Trop de messages. Attend un peu." });
      return;
    }

    const clean = String(text).trim().slice(0, 160);
    if (!clean) return;

    // Handle emotes
    const firstWord = clean.split(" ")[0].toLowerCase();
    if (emoteCommands[firstWord]) {
      current.emote = emoteCommands[firstWord];
      current.emoteUntil = Date.now() + 4000;
      const emoteMsg: ChatMessage = {
        id: crypto.randomUUID(),
        pseudo: current.pseudo,
        role: current.role,
        text: `*${firstWord.slice(1)}*`,
        at: Date.now(),
        type: "emote",
      };
      chatLog.push(emoteMsg);
      io.emit("chat", emoteMsg);
      io.emit("emote", { pseudo: current.pseudo, emote: current.emote });
      emitWorld();
      return;
    }

    // Handle scan command
    if (clean.toLowerCase() === "/scan") {
      const zone = current.zone;
      if (!current.scannedSectors.includes(zone)) {
        current.scannedSectors.push(zone);
      }
      socket.emit("notification", { type: "scan", title: `Scan: ${zones[zone]?.label ?? zone}`, body: `Secteur analyse. Zones scannees: ${current.scannedSectors.length}` });
      // Check glitch symbols
      if (activeEvent.active) {
        const nearSymbol = activeEvent.glitchSymbols.find((s) => !s.found && Math.abs(s.x - current.x) < 80 && Math.abs(s.y - current.y) < 80);
        if (nearSymbol) {
          nearSymbol.found = true;
          current.xp += 30;
          current.level = levelFromXp(current.xp);
          socket.emit("notification", { type: "achievement", title: "Symbole Glitch trouve !", body: "+30 XP" });
          emitSystem(`${current.pseudo} a detecte un symbole glitch !`);
        }
      }
      emitWorld();
      return;
    }

    // Handle talk to NPC
    if (clean.toLowerCase().startsWith("/talk ")) {
      const npcName = clean.slice(6).trim().toUpperCase();
      const npc = systemPlayers.find((p) => p.pseudo === npcName);
      if (npc) {
        const distance = Math.sqrt(Math.pow(current.x - npc.x, 2) + Math.pow(current.y - npc.y, 2));
        if (distance > 150) {
          socket.emit("notification", { type: "warning", title: "Trop loin", body: `Rapproche-toi de ${npc.pseudo} pour lui parler.` });
          return;
        }
        current.interactions++;
        const dialogues = npcDialogues[npc.pseudo] ?? ["..."];
        const line = dialogues[Math.floor(Math.random() * dialogues.length)];
        const npcMsg: ChatMessage = {
          id: crypto.randomUUID(),
          pseudo: npc.pseudo,
          role: npc.role,
          text: line,
          at: Date.now(),
          type: "npc",
        };
        chatLog.push(npcMsg);
        io.emit("chat", npcMsg);

        if (current.interactions >= 3 && !current.completedMissions.includes("fragment-404")) {
          socket.emit("notification", { type: "hint", title: "Protocole FRAGMENT 404", body: "Tu as parle a assez de NPCs ! Scanne l'Arcade et valide." });
        }
        return;
      }
      socket.emit("notification", { type: "warning", title: "NPC introuvable", body: "Essaie /talk VOLT, /talk NYX ou /talk ECHO" });
      return;
    }

    const message: ChatMessage = { id: crypto.randomUUID(), pseudo: current.pseudo, role: current.role, text: clean, at: Date.now(), type: "chat" };
    chatLog.push(message);
    if (chatLog.length > 200) chatLog.splice(0, chatLog.length - 100);
    io.emit("chat", message);
  });

  // --- Mission completion ---
  socket.on("mission:complete", (missionId: string) => {
    const current = players.get(socket.id);
    if (!current) return;
    if (!checkRate(`mission:${socket.id}`, 3, 5000)) return;

    const cleanId = String(missionId).trim().slice(0, 32);
    const success = completeMission(current, cleanId);
    if (success) {
      const def = missionDefinitions[cleanId];
      emitSystem(`${current.pseudo} a complete le protocole ${cleanId.toUpperCase()} ! Badge: ${def.badge}`);
      socket.emit("notification", { type: "achievement", title: `Protocole Complete !`, body: `+${def.xpReward} XP / Badge: ${def.badge}` });
      socket.emit("sfx", "achievement");
      emitWorld();
    } else {
      socket.emit("notification", { type: "warning", title: "Protocole non valide", body: "Conditions non remplies. Lis les instructions du protocole." });
    }
  });

  // --- Interact with terminal ---
  socket.on("terminal:interact", () => {
    const current = players.get(socket.id);
    if (!current) return;
    if (current.zone === "terminal" || Math.abs(current.x - 918) < 60 && Math.abs(current.y - 440) < 60) {
      socket.emit("notification", { type: "terminal", title: "TERMINAL 404", body: "Acces autorise. Protocole SIGNAL PERDU disponible." });
      socket.emit("sfx", "terminal");
    }
  });

  // --- Admin events ---
  socket.on("admin:event", (eventName: string) => {
    const current = players.get(socket.id);
    if (!current || !["Admin", "Founder"].includes(current.role)) return;
    activeEvent = randomEvent();
    activeEvent.name = String(eventName).trim().slice(0, 32) || activeEvent.name;
    emitSystem(`Event en cours : ${activeEvent.name}`);
    io.emit("sfx", "event");
    emitWorld();
  });

  socket.on("admin:announce", (text: string) => {
    const current = players.get(socket.id);
    if (!current || !["Admin", "Founder"].includes(current.role)) return;
    const clean = String(text).trim().slice(0, 200);
    if (!clean) return;
    emitSystem(`[ANNONCE] ${clean}`);
  });

  socket.on("admin:mute", (targetPseudo: string) => {
    const current = players.get(socket.id);
    if (!current || !["Admin", "Founder"].includes(current.role)) return;
    const target = [...players.values()].find((p) => p.pseudo.toLowerCase() === String(targetPseudo).toLowerCase());
    if (target) {
      target.muted = !target.muted;
      emitSystem(`${target.pseudo} a ete ${target.muted ? "mute" : "unmute"} par ${current.pseudo}.`);
    }
  });

  // --- Disconnect ---
  socket.on("disconnect", () => {
    const current = players.get(socket.id);
    players.delete(socket.id);
    if (current) emitSystem(`${current.pseudo} a quitte le District.`);
    emitWorld();
  });
});

// --- NPC wandering AI ---
setInterval(() => {
  for (const npc of systemPlayers) {
    npc.x += (Math.random() - 0.5) * 30;
    npc.y += (Math.random() - 0.5) * 20;
    npc.x = clamp(npc.x, 200, 1080);
    npc.y = clamp(npc.y, 280, 620);
    npc.zone = getZone(npc.x, npc.y);
  }
  if (players.size > 0) emitWorld();
}, 8000);

// --- Event rotation ---
setInterval(() => {
  if (Date.now() > activeEvent.until) {
    activeEvent = randomEvent();
    emitSystem(`Nouvel event : ${activeEvent.name}`);
    io.emit("sfx", "event");
    emitWorld();
  }
}, 60000);

// --- Random NPC chatter ---
setInterval(() => {
  if (players.size === 0) return;
  const npc = systemPlayers[Math.floor(Math.random() * systemPlayers.length)];
  const dialogues = npcDialogues[npc.pseudo] ?? ["..."];
  if (Math.random() < 0.3) {
    const line = dialogues[Math.floor(Math.random() * dialogues.length)];
    const msg: ChatMessage = { id: crypto.randomUUID(), pseudo: npc.pseudo, role: npc.role, text: line, at: Date.now(), type: "npc" };
    chatLog.push(msg);
    io.emit("chat", msg);
  }
}, 45000);

function createPlayer(id: string, pseudo: string, avatar: Avatar): Player {
  const role: Role = pseudo.toLowerCase() === "founder" || pseudo.toLowerCase() === "admin" ? "Founder" : "New User";
  const x = 610 + Math.random() * 90;
  const y = 315 + Math.random() * 58;
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
    x,
    y,
    zone: getZone(x, y),
    completedMissions: [],
    interactions: 0,
    scannedSectors: [],
    lastActive: Date.now(),
  };
}

function emitSystem(text: string) {
  const message: ChatMessage = { id: crypto.randomUUID(), pseudo: "SYSTEM 2042", role: "Sentinel", text, at: Date.now(), type: "system" };
  chatLog.push(message);
  if (chatLog.length > 200) chatLog.splice(0, chatLog.length - 100);
  io.emit("chat", message);
}

function emitWorld() {
  const state = {
    year: 2042,
    event: activeEvent,
    online: [...players.values(), ...systemPlayers],
    chatLog: chatLog.slice(-40),
  };
  io.emit("world", state);
}

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

const port = Number(process.env.PORT ?? 3042);
httpServer.listen(port, "127.0.0.1", () => {
  console.log(`NEON DISTRICT server online on http://127.0.0.1:${port}`);
});
