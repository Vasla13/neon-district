import type { Role, Avatar } from "../types/game";

// === Isometric grid ===
export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_COLS = 40;
export const MAP_ROWS = 40;
export const ORIGIN_X = 1300;
export const ORIGIN_Y = 200;

// === World pixel size (auto) ===
export const WORLD_W = 3200;
export const WORLD_H = 2000;

/**
 * City tile types:
 * 0 = void (nothing)
 * 1 = sidewalk (walkable)
 * 2 = road (walkable)
 * 3 = building (blocked, tall)
 * 4 = park/grass (walkable)
 * 5 = plaza (walkable, special)
 * 6 = water (blocked)
 * 7 = bridge (walkable)
 * 8 = entrance (walkable, triggers building interior)
 */
function generateCityMap(): number[][] {
  const m: number[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    m[r] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      m[r][c] = 0;
    }
  }

  // Fill base with sidewalk
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      m[r][c] = 1;
    }
  }

  // === ROADS (horizontal and vertical) ===
  const hRoads = [5, 6, 14, 15, 24, 25, 33, 34];
  const vRoads = [5, 6, 14, 15, 24, 25, 33, 34];
  for (const r of hRoads) {
    for (let c = 1; c < MAP_COLS - 1; c++) m[r][c] = 2;
  }
  for (const c of vRoads) {
    for (let r = 1; r < MAP_ROWS - 1; r++) m[r][c] = 2;
  }

  // === BUILDINGS (blocks between roads) ===
  const blocks = [
    // Row 1 of blocks
    { r1: 2, r2: 4, c1: 2, c2: 4 },
    { r1: 2, r2: 4, c1: 8, c2: 13 },
    { r1: 2, r2: 4, c1: 17, c2: 23 },
    { r1: 2, r2: 4, c1: 27, c2: 32 },
    // Row 2
    { r1: 8, r2: 13, c1: 2, c2: 4 },
    { r1: 8, r2: 10, c1: 8, c2: 10 },
    { r1: 11, r2: 13, c1: 12, c2: 13 },
    { r1: 8, r2: 10, c1: 17, c2: 19 },
    { r1: 11, r2: 13, c1: 21, c2: 23 },
    { r1: 8, r2: 13, c1: 27, c2: 29 },
    { r1: 8, r2: 10, c1: 31, c2: 32 },
    // Row 3
    { r1: 17, r2: 19, c1: 2, c2: 4 },
    { r1: 21, r2: 23, c1: 2, c2: 4 },
    { r1: 17, r2: 23, c1: 8, c2: 10 },
    { r1: 17, r2: 19, c1: 12, c2: 13 },
    { r1: 17, r2: 23, c1: 17, c2: 18 },
    { r1: 17, r2: 19, c1: 20, c2: 23 },
    { r1: 21, r2: 23, c1: 20, c2: 21 },
    { r1: 17, r2: 23, c1: 27, c2: 32 },
    // Row 4
    { r1: 27, r2: 32, c1: 2, c2: 4 },
    { r1: 27, r2: 29, c1: 8, c2: 10 },
    { r1: 30, r2: 32, c1: 8, c2: 9 },
    { r1: 27, r2: 32, c1: 12, c2: 13 },
    { r1: 27, r2: 29, c1: 17, c2: 19 },
    { r1: 30, r2: 32, c1: 21, c2: 23 },
    { r1: 27, r2: 29, c1: 27, c2: 29 },
    { r1: 30, r2: 32, c1: 31, c2: 32 },
  ];
  for (const b of blocks) {
    for (let r = b.r1; r <= b.r2; r++) {
      for (let c = b.c1; c <= b.c2; c++) {
        m[r][c] = 3;
      }
    }
  }

  // === ENTRANCES (doors on buildings) ===
  const entrances = [
    [4, 3], [10, 4], [13, 8], [10, 17], [19, 12], [23, 2], [19, 20],
    [29, 8], [32, 12], [29, 17], [32, 21], [29, 27],
  ];
  for (const [r, c] of entrances) {
    if (m[r][c] === 3) m[r][c] = 8;
  }

  // === PARK (center open area) ===
  for (let r = 11; r <= 13; r++) {
    for (let c = 17; c <= 23; c++) {
      if (m[r][c] === 1) m[r][c] = 4;
    }
  }
  // Small park in block gap
  for (let r = 20; r <= 23; r++) {
    for (let c = 12; c <= 13; c++) {
      if (m[r][c] !== 2) m[r][c] = 4;
    }
  }

  // === PLAZA (main square) ===
  for (let r = 11; r <= 13; r++) {
    for (let c = 11; c <= 13; c++) {
      m[r][c] = 5;
    }
  }

  // === WATER (canal on bottom edge) ===
  for (let c = 1; c < MAP_COLS - 1; c++) {
    m[MAP_ROWS - 2][c] = 6;
    m[MAP_ROWS - 3][c] = 6;
  }
  // Bridges over canal
  for (const c of [5, 6, 14, 15, 24, 25]) {
    m[MAP_ROWS - 2][c] = 7;
    m[MAP_ROWS - 3][c] = 7;
  }

  return m;
}

export const CITY_MAP = generateCityMap();

// === Building info (tied to building blocks) ===
export interface BuildingDef {
  id: string;
  name: string;
  col: number;
  row: number;
  w: number;
  h: number;
  floors: number;
  color: string;
  accent: string;
  type: "residential" | "commercial" | "club" | "arcade" | "office" | "special" | "park";
}

export const BUILDINGS: BuildingDef[] = [
  // Row 1
  { id: "apt-1", name: "Bloc Residentiel A", col: 2, row: 2, w: 3, h: 3, floors: 4, color: "#0c1a28", accent: "#4ff5ff", type: "residential" },
  { id: "neon-bar", name: "NEON BAR", col: 8, row: 2, w: 6, h: 3, floors: 2, color: "#0a2832", accent: "#4ff5ff", type: "club" },
  { id: "mega-corp", name: "MEGA CORP", col: 17, row: 2, w: 7, h: 3, floors: 8, color: "#0c1420", accent: "#5d9bff", type: "office" },
  { id: "arcade-zone", name: "ARCADE ZONE", col: 27, row: 2, w: 6, h: 3, floors: 2, color: "#1a0828", accent: "#b983ff", type: "arcade" },
  // Row 2
  { id: "apt-2", name: "Bloc B", col: 2, row: 8, w: 3, h: 6, floors: 6, color: "#0a1520", accent: "#4ff5ff", type: "residential" },
  { id: "hack-lab", name: "HACK LAB", col: 8, row: 8, w: 3, h: 3, floors: 3, color: "#0d2f14", accent: "#73ff7b", type: "special" },
  { id: "data-center", name: "DATA CENTER", col: 12, row: 11, w: 2, h: 3, floors: 5, color: "#081a0c", accent: "#73ff7b", type: "office" },
  { id: "lounge-1", name: "CHILL LOUNGE", col: 17, row: 8, w: 3, h: 3, floors: 1, color: "#0c1e34", accent: "#5d9bff", type: "club" },
  { id: "ghost-hq", name: "GHOST HQ", col: 21, row: 11, w: 3, h: 3, floors: 4, color: "#1f0d3a", accent: "#b983ff", type: "special" },
  { id: "tower-1", name: "TOUR NEON", col: 27, row: 8, w: 3, h: 6, floors: 10, color: "#0c1a24", accent: "#4ff5ff", type: "office" },
  { id: "shop-1", name: "CYBER SHOP", col: 31, row: 8, w: 2, h: 3, floors: 2, color: "#1a0820", accent: "#ff55ef", type: "commercial" },
  // Row 3
  { id: "apt-3", name: "Bloc C", col: 2, row: 17, w: 3, h: 3, floors: 3, color: "#0a1822", accent: "#4ff5ff", type: "residential" },
  { id: "apt-4", name: "Bloc D", col: 2, row: 21, w: 3, h: 3, floors: 5, color: "#0c1420", accent: "#5d9bff", type: "residential" },
  { id: "event-hall", name: "EVENT HALL", col: 8, row: 17, w: 3, h: 7, floors: 3, color: "#200a20", accent: "#ff55ef", type: "club" },
  { id: "mini-mart", name: "24/7 MART", col: 12, row: 17, w: 2, h: 3, floors: 1, color: "#0a2028", accent: "#73ff7b", type: "commercial" },
  { id: "dj-tower", name: "DJ TOWER", col: 17, row: 17, w: 2, h: 7, floors: 6, color: "#2f0d29", accent: "#ff55ef", type: "club" },
  { id: "fight-club", name: "FIGHT CLUB", col: 20, row: 17, w: 4, h: 3, floors: 2, color: "#200a0a", accent: "#ff5165", type: "special" },
  { id: "hideout", name: "HIDEOUT", col: 20, row: 21, w: 2, h: 3, floors: 2, color: "#1a0c0c", accent: "#ff5165", type: "special" },
  { id: "district-hq", name: "DISTRICT HQ", col: 27, row: 17, w: 6, h: 7, floors: 12, color: "#0a1220", accent: "#ffd700", type: "office" },
  // Row 4
  { id: "warehouse", name: "ENTREPOT", col: 2, row: 27, w: 3, h: 6, floors: 2, color: "#0c1418", accent: "#2a5060", type: "commercial" },
  { id: "garage", name: "GARAGE", col: 8, row: 27, w: 3, h: 3, floors: 1, color: "#0a1420", accent: "#4ff5ff", type: "commercial" },
  { id: "bunker", name: "BUNKER", col: 8, row: 30, w: 2, h: 3, floors: 1, color: "#0a0c10", accent: "#2a5060", type: "special" },
  { id: "prison", name: "DETENTION", col: 12, row: 27, w: 2, h: 6, floors: 4, color: "#1a0808", accent: "#ff5165", type: "special" },
  { id: "clinic", name: "CLINIC 2042", col: 17, row: 27, w: 3, h: 3, floors: 3, color: "#0a2028", accent: "#86faff", type: "commercial" },
  { id: "junkyard", name: "JUNKYARD", col: 21, row: 30, w: 3, h: 3, floors: 1, color: "#0c0c0a", accent: "#5a5a40", type: "commercial" },
  { id: "radio-tower", name: "RADIO NEON", col: 27, row: 27, w: 3, h: 3, floors: 7, color: "#0c1a24", accent: "#ff55ef", type: "office" },
  { id: "safe-house", name: "SAFE HOUSE", col: 31, row: 30, w: 2, h: 3, floors: 2, color: "#0a1018", accent: "#73ff7b", type: "special" },
];

// === Street furniture ===
export interface StreetPropDef {
  id: string;
  col: number;
  row: number;
  type: "streetlight" | "bench" | "hydrant" | "sign" | "tree" | "trash" | "mailbox" | "car" | "billboard" | "fountain";
  accent: string;
  label?: string;
}

export const STREET_PROPS: StreetPropDef[] = [
  // Street lights along roads
  ...[4,7,10,13,16,19,22,26,28,30].flatMap(c => [
    { id: `sl-${c}-4`, col: c, row: 4, type: "streetlight" as const, accent: "#4ff5ff" },
    { id: `sl-${c}-16`, col: c, row: 16, type: "streetlight" as const, accent: "#4ff5ff" },
    { id: `sl-${c}-26`, col: c, row: 26, type: "streetlight" as const, accent: "#ff55ef" },
  ]),
  ...[4,7,10,13,16,19,22,26,28,30].flatMap(r => [
    { id: `sl-4-${r}`, col: 4, row: r, type: "streetlight" as const, accent: "#4ff5ff" },
    { id: `sl-16-${r}`, col: 16, row: r, type: "streetlight" as const, accent: "#4ff5ff" },
  ]),
  // Trees in park
  { id: "tree-1", col: 18, row: 11, type: "tree", accent: "#73ff7b" },
  { id: "tree-2", col: 20, row: 12, type: "tree", accent: "#4bea69" },
  { id: "tree-3", col: 22, row: 11, type: "tree", accent: "#73ff7b" },
  { id: "tree-4", col: 19, row: 13, type: "tree", accent: "#2d8a3e" },
  { id: "tree-5", col: 21, row: 13, type: "tree", accent: "#4bea69" },
  { id: "tree-6", col: 12, row: 20, type: "tree", accent: "#73ff7b" },
  { id: "tree-7", col: 13, row: 22, type: "tree", accent: "#4bea69" },
  // Benches
  { id: "bench-1", col: 12, row: 12, type: "bench", accent: "#4ff5ff" },
  { id: "bench-2", col: 13, row: 12, type: "bench", accent: "#4ff5ff" },
  { id: "bench-3", col: 12, row: 21, type: "bench", accent: "#5d9bff" },
  // Fountain in plaza
  { id: "fountain-1", col: 12, row: 12, type: "fountain", accent: "#86faff" },
  // Signs
  { id: "sign-bar", col: 7, row: 3, type: "sign", accent: "#4ff5ff", label: "BAR →" },
  { id: "sign-arcade", col: 26, row: 3, type: "sign", accent: "#b983ff", label: "ARCADE →" },
  { id: "sign-hq", col: 26, row: 18, type: "sign", accent: "#ffd700", label: "HQ →" },
  { id: "sign-park", col: 16, row: 12, type: "sign", accent: "#73ff7b", label: "PARK" },
  // Billboards
  { id: "bb-1", col: 7, row: 14, type: "billboard", accent: "#ff55ef", label: "2042" },
  { id: "bb-2", col: 26, row: 14, type: "billboard", accent: "#b983ff", label: "NEON" },
  { id: "bb-3", col: 16, row: 24, type: "billboard", accent: "#4ff5ff", label: "DISTRICT" },
  // Cars parked
  { id: "car-1", col: 7, row: 5, type: "car", accent: "#ff5165" },
  { id: "car-2", col: 10, row: 6, type: "car", accent: "#4ff5ff" },
  { id: "car-3", col: 20, row: 15, type: "car", accent: "#ff55ef" },
  { id: "car-4", col: 30, row: 25, type: "car", accent: "#73ff7b" },
  // Hydrants, mailbox, trash
  { id: "hyd-1", col: 7, row: 7, type: "hydrant", accent: "#ff5165" },
  { id: "hyd-2", col: 16, row: 16, type: "hydrant", accent: "#ff5165" },
  { id: "mb-1", col: 7, row: 16, type: "mailbox", accent: "#4ff5ff" },
  { id: "trash-1", col: 16, row: 7, type: "trash", accent: "#2a5060" },
  { id: "trash-2", col: 26, row: 7, type: "trash", accent: "#2a5060" },
];

// === Zones (for detection) ===
export const ZONES: Record<string, { col: number; row: number; radius: number; label: string }> = {
  spawn:    { col: 12, row: 12, radius: 2, label: "Place Centrale" },
  bar:      { col: 10, row: 3, radius: 3, label: "Neon Bar" },
  arcade:   { col: 29, row: 3, radius: 3, label: "Arcade Zone" },
  megacorp: { col: 20, row: 3, radius: 3, label: "Mega Corp" },
  park:     { col: 20, row: 12, radius: 3, label: "Parc Neon" },
  hacklab:  { col: 9, row: 9, radius: 2, label: "Hack Lab" },
  event:    { col: 9, row: 20, radius: 3, label: "Event Hall" },
  dj:       { col: 17, row: 20, radius: 2, label: "DJ Tower" },
  hq:       { col: 30, row: 20, radius: 3, label: "District HQ" },
  staff:    { col: 30, row: 10, radius: 3, label: "Tour Neon" },
  clinic:   { col: 18, row: 28, radius: 2, label: "Clinique" },
  prison:   { col: 12, row: 30, radius: 2, label: "Detention" },
  canal:    { col: 15, row: 37, radius: 5, label: "Canal" },
};

// === Missions ===
export const MISSIONS = [
  { id: "signal-lost", title: "PROTOCOLE 01 — SIGNAL PERDU", body: "Trouve le Terminal 404 pres du Data Center et interagis avec.", reward: "+100 XP", hint: "Va vers le Data Center (quartier est) et clique dessus." },
  { id: "fragment-404", title: "PROTOCOLE 02 — FRAGMENT 404", body: "Parle a 3 NPCs (/talk VOLT, NYX, ECHO) dans differents quartiers.", reward: "+80 XP", hint: "Les NPCs se baladent dans la ville. /talk NOM." },
  { id: "ghost-trace", title: "PROTOCOLE 03 — TRACE FANTOME", body: "Detecte un symbole glitch pendant un event avec /scan.", reward: "+150 XP", hint: "/scan dans differentes zones pendant un event." },
  { id: "neon-surge", title: "PROTOCOLE 04 — NEON SURGE", body: "Explore au moins 5 quartiers differents de la ville.", reward: "+120 XP", hint: "Visite Bar, Arcade, Parc, HQ, Event Hall..." },
  { id: "code-breaker", title: "PROTOCOLE 05 — CODE BREAKER", body: "Complete 3 protocoles pour debloquer ce badge.", reward: "+200 XP", hint: "Termine les missions precedentes." },
];

// === Role colors ===
export const ROLE_COLORS: Record<Role, number> = {
  "New User": 0x76f8ff, Runner: 0x36dfff, Hacker: 0x78ff7e,
  Architect: 0xffffff, DJ: 0xff55ef, Sentinel: 0x5d9bff,
  Ghost: 0xbc83ff, Admin: 0xff5165, Founder: 0xffd700,
};

export const ROLE_CSS: Record<Role, string> = {
  "New User": "role-new", Runner: "role-runner", Hacker: "role-hacker",
  Architect: "role-architect", DJ: "role-dj", Sentinel: "role-sentinel",
  Ghost: "role-ghost", Admin: "role-admin", Founder: "role-founder",
};

export const AVATAR_PALETTE: Record<Avatar, { body: string; trim: string; glow: string; visor: string }> = {
  runner: { body: "#0d2d3f", trim: "#15cbed", glow: "#4ff5ff", visor: "#15cbed" },
  hacker: { body: "#0d2f14", trim: "#4bea69", glow: "#73ff7b", visor: "#4bea69" },
  ghost:  { body: "#1f0d3a", trim: "#a574ff", glow: "#d3a8ff", visor: "#a574ff" },
  dj:     { body: "#2f0d29", trim: "#ff49e7", glow: "#ff88f5", visor: "#ff49e7" },
};
