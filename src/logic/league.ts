import type { Match } from '../types';

export interface Standing {
  entryId: string;
  played: number;
  wins: number;
  losses: number;
  gamesFor: number;
  gamesAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
}

/** リーグ順位：勝数 → 直接対決（2者のとき）→ 得失ゲーム差 → 得失点差 */
export function standings(entryIds: string[], matches: Match[]): Standing[] {
  const map = new Map<string, Standing>();
  for (const id of entryIds)
    map.set(id, { entryId: id, played: 0, wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, pointsFor: 0, pointsAgainst: 0, rank: 0 });
  for (const m of matches) {
    if (m.status !== 'done' || !m.a || !m.b || !m.winner) continue;
    const A = map.get(m.a);
    const B = map.get(m.b);
    if (!A || !B) continue;
    A.played++;
    B.played++;
    if (m.winner === 'a') (A.wins++, B.losses++);
    else (B.wins++, A.losses++);
    const units: [number, number][] = m.rubbers.length
      ? m.rubbers.filter((r) => r.winner).map((r) => (r.winner === 'a' ? [1, 0] : [0, 1]) as [number, number])
      : m.games.map(([x, y]) => (x > y ? [1, 0] : [0, 1]) as [number, number]);
    for (const [x, y] of units) {
      A.gamesFor += x;
      A.gamesAgainst += y;
      B.gamesFor += y;
      B.gamesAgainst += x;
    }
    const pts = m.rubbers.length ? m.rubbers.flatMap((r) => r.games) : m.games;
    for (const [x, y] of pts) {
      A.pointsFor += x;
      A.pointsAgainst += y;
      B.pointsFor += y;
      B.pointsAgainst += x;
    }
  }
  const list = [...map.values()];
  const h2h = (x: string, y: string): number => {
    const m = matches.find((mm) => mm.status === 'done' && ((mm.a === x && mm.b === y) || (mm.a === y && mm.b === x)));
    if (!m || !m.winner) return 0;
    const w = m[m.winner];
    return w === x ? -1 : 1;
  };
  list.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const tied = list.filter((s) => s.wins === x.wins);
    if (tied.length === 2) {
      const h = h2h(x.entryId, y.entryId);
      if (h) return h;
    }
    const gd = y.gamesFor - y.gamesAgainst - (x.gamesFor - x.gamesAgainst);
    if (gd) return gd;
    return y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst);
  });
  list.forEach((s, i) => (s.rank = i + 1));
  return list;
}
