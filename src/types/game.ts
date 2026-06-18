// === Shared types for Neon District ===

export type Role = "New User" | "Runner" | "Hacker" | "Architect" | "DJ" | "Sentinel" | "Ghost" | "Admin" | "Founder";
export type Avatar = "runner" | "hacker" | "ghost" | "dj";

export interface Player {
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
  emote?: string;
  zone?: string;
  completedMissions?: string[];
  interactions?: number;
  scannedSectors?: string[];
}

export interface ChatMessage {
  id: string;
  pseudo: string;
  role: Role;
  text: string;
  at: number;
  type?: "system" | "chat" | "emote" | "npc" | "achievement";
}

export interface GameEvent {
  name: string;
  active: boolean;
  until: number;
  description: string;
}

export interface WorldState {
  year: 2042;
  event: GameEvent;
  online: Player[];
  chatLog: ChatMessage[];
}

export interface Session {
  pseudo: string;
  avatar: Avatar;
  token: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
}

export interface GridPos {
  col: number;
  row: number;
}

export interface ScreenPos {
  x: number;
  y: number;
}
