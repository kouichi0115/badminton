import type { AppState, Match } from '../types';

export function entryPlayers(state: AppState, entryId: string | null): string[] {
  if (!entryId) return [];
  return state.entries.find((e) => e.id === entryId)?.playerIds ?? [];
}

export function matchPlayers(state: AppState, m: Match): string[] {
  return [...entryPlayers(state, m.a), ...entryPlayers(state, m.b)];
}

export function isReady(m: Match): boolean {
  return m.status === 'waiting' && !!m.a && !!m.b;
}

export interface Candidate {
  match: Match;
  /** 出場中の選手がいる */
  busy: boolean;
  /** 休憩時間が足りない選手がいる（残り分） */
  restLeft: number;
}

/** 次にコートに入れる試合の候補（試合番号順）。出場中の選手を含む試合は後ろへ */
export function candidates(state: AppState, now = Date.now()): Candidate[] {
  const busyPlayers = new Set<string>();
  const lastEnd = new Map<string, number>();
  for (const m of state.matches) {
    const ps = matchPlayers(state, m);
    if (m.status === 'called' || m.status === 'playing') ps.forEach((p) => busyPlayers.add(p));
    if (m.status === 'done' && m.endedAt) ps.forEach((p) => lastEnd.set(p, Math.max(lastEnd.get(p) ?? 0, m.endedAt!)));
  }
  const restMs = state.tournament.restMinutes * 60000;
  const list = state.matches
    .filter(isReady)
    .sort((x, y) => x.number - y.number)
    .map((match) => {
      const ps = matchPlayers(state, match);
      const busy = ps.some((p) => busyPlayers.has(p));
      let restLeft = 0;
      for (const p of ps) {
        const e = lastEnd.get(p);
        if (e && now - e < restMs) restLeft = Math.max(restLeft, Math.ceil((restMs - (now - e)) / 60000));
      }
      return { match, busy, restLeft };
    });
  return [...list.filter((c) => !c.busy && !c.restLeft), ...list.filter((c) => !c.busy && c.restLeft), ...list.filter((c) => c.busy)];
}

export function freeCourts(state: AppState): number[] {
  const used = new Set(state.matches.filter((m) => m.status === 'called' || m.status === 'playing').map((m) => m.court));
  const out: number[] = [];
  for (let c = 1; c <= state.tournament.courts; c++) if (!used.has(c)) out.push(c);
  return out;
}

export interface PlannedMatch {
  matchId: string;
  court: number;
  start: number; // 分（0時からの）
  end: number;
}

/**
 * 進行予定の見積もり。試合番号順に、前の試合の終了と休憩時間を考慮して空いたコートへ入れていく。
 * まだ対戦者が決まっていない試合は、元になる試合の終了を待つ。
 */
export function simulate(state: AppState, startMin: number): PlannedMatch[] {
  const evById = new Map(state.events.map((e) => [e.id, e]));
  const rest = state.tournament.restMinutes;
  const courts = new Array(Math.max(1, state.tournament.courts)).fill(startMin);
  const feeders = new Map<string, string[]>();
  for (const m of state.matches) {
    for (const n of [m.nextMatchId, m.loserNextMatchId]) if (n) feeders.set(n, [...(feeders.get(n) ?? []), m.id]);
  }
  const finish = new Map<string, number>();
  const playerFree = new Map<string, number>();
  const result: PlannedMatch[] = [];
  for (const m of state.matches) if (m.status === 'bye') finish.set(m.id, startMin);

  const queue = state.matches.filter((m) => m.status !== 'bye').sort((x, y) => x.number - y.number);
  let guard = 0;
  while (queue.length && guard++ < 100000) {
    let ci = 0;
    for (let i = 1; i < courts.length; i++) if (courts[i] < courts[ci]) ci = i;
    const t = courts[ci];
    let picked = -1;
    let earliest = Infinity;
    for (let i = 0; i < queue.length && i < 40; i++) {
      const m = queue[i];
      const deps = feeders.get(m.id) ?? [];
      if (deps.some((d) => !finish.has(d))) continue;
      let ready = Math.max(startMin, ...deps.map((d) => finish.get(d)! + rest));
      for (const p of matchPlayers(state, m)) ready = Math.max(ready, (playerFree.get(p) ?? -Infinity) + rest);
      if (ready <= t) {
        picked = i;
        break;
      }
      earliest = Math.min(earliest, ready);
    }
    if (picked < 0) {
      courts[ci] = Number.isFinite(earliest) ? earliest : t + 1;
      continue;
    }
    const m = queue.splice(picked, 1)[0];
    const dur = evById.get(m.eventId)?.estMinutes ?? 20;
    const p: PlannedMatch = { matchId: m.id, court: ci + 1, start: t, end: t + dur };
    result.push(p);
    courts[ci] = p.end;
    finish.set(m.id, p.end);
    for (const pl of matchPlayers(state, m)) playerFree.set(pl, p.end);
  }
  return result;
}
