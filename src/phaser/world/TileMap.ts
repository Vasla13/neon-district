import { TILE_W, TILE_H, ORIGIN_X, ORIGIN_Y, CITY_MAP, MAP_COLS, MAP_ROWS } from "../../utils/constants";
import type { GridPos, ScreenPos } from "../../types/game";

export function gridToScreen(col: number, row: number): ScreenPos {
  return {
    x: ORIGIN_X + (col - row) * (TILE_W / 2),
    y: ORIGIN_Y + (col + row) * (TILE_H / 2),
  };
}

export function screenToGrid(sx: number, sy: number): GridPos {
  const rx = sx - ORIGIN_X;
  const ry = sy - ORIGIN_Y;
  const col = Math.round((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2);
  const row = Math.round((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2);
  return { col, row };
}

export function isWalkable(col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return false;
  const t = CITY_MAP[row][col];
  return t === 1 || t === 2 || t === 4 || t === 5 || t === 7 || t === 8;
}

export function depthOf(col: number, row: number, offset = 0): number {
  return (col + row) * 10 + offset;
}

export function findPath(start: GridPos, end: GridPos): GridPos[] {
  if (!isWalkable(end.col, end.row)) return [];
  if (start.col === end.col && start.row === end.row) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const queue: GridPos[] = [start];
  const visited = new Set<string>([key(start.col, start.row)]);
  const parents = new Map<string, GridPos | null>();
  parents.set(key(start.col, start.row), null);

  const dirs = [
    { dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
    { dc: -1, dr: -1 }, { dc: 1, dr: -1 }, { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.col === end.col && cur.row === end.row) {
      const path: GridPos[] = [];
      let k: string | null = key(cur.col, cur.row);
      while (k) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        const p = parents.get(k);
        k = p ? key(p.col, p.row) : null;
      }
      path.shift();
      return path;
    }
    for (const d of dirs) {
      const nc = cur.col + d.dc, nr = cur.row + d.dr;
      const nk = key(nc, nr);
      if (visited.has(nk) || !isWalkable(nc, nr)) continue;
      if (d.dc !== 0 && d.dr !== 0) {
        if (!isWalkable(cur.col + d.dc, cur.row) || !isWalkable(cur.col, cur.row + d.dr)) continue;
      }
      visited.add(nk);
      parents.set(nk, cur);
      queue.push({ col: nc, row: nr });
    }
  }
  return [];
}
