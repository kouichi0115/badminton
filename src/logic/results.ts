import type { AppState, Match } from '../types';
import { standings } from './league';

export interface Placement {
  place: number;
  label: string;
  entryId: string;
}

/** 種目の入賞者（優勝・準優勝・3位・ベスト8…） */
export function placements(state: AppState, eventId: string, depth = 8): Placement[] {
  const ms = state.matches.filter((m) => m.eventId === eventId);
  const main = ms.filter((m) => m.stage === 'main');
  const ev = state.events.find((e) => e.id === eventId);
  if (!main.length) {
    if (ev?.format === 'league') {
      const ids = state.entries.filter((e) => e.eventId === eventId).map((e) => e.id);
      const done = ms.length > 0 && ms.every((m) => m.status === 'done');
      if (!done) return [];
      return standings(ids, ms)
        .slice(0, depth)
        .map((s) => ({ place: s.rank, label: placeLabel(s.rank), entryId: s.entryId }));
    }
    return [];
  }
  const rounds = Math.max(...main.map((m) => m.round));
  const out: Placement[] = [];
  const final = main.find((m) => m.round === rounds);
  if (final?.winner) {
    out.push({ place: 1, label: '優勝', entryId: final[final.winner]! });
    out.push({ place: 2, label: '準優勝', entryId: final[final.winner === 'a' ? 'b' : 'a']! });
  }
  const third = ms.find((m) => m.stage === 'third');
  if (third) {
    if (third.winner) {
      out.push({ place: 3, label: '第3位', entryId: third[third.winner]! });
      out.push({ place: 4, label: '第4位', entryId: third[third.winner === 'a' ? 'b' : 'a']! });
    }
  }
  let place = third ? 5 : 3;
  for (let r = rounds - 1; r >= 1 && place <= depth; r--) {
    if (third && r === rounds - 1) continue;
    const losers = main
      .filter((m) => m.round === r && m.status === 'done' && m.winner)
      .map((m) => m[m.winner === 'a' ? 'b' : 'a']!)
      .filter(Boolean);
    const label = place === 3 ? '第3位' : `ベスト${2 ** (rounds - r + 1)}`;
    for (const id of losers) out.push({ place, label, entryId: id });
    place = 2 ** (rounds - r + 1) + 1;
  }
  return out;
}

function placeLabel(rank: number) {
  return rank === 1 ? '優勝' : rank === 2 ? '準優勝' : `第${rank}位`;
}

/** 選手の戦歴 */
export function playerRecord(state: AppState, playerId: string): { match: Match; side: 'a' | 'b' }[] {
  const entryIds = new Set(state.entries.filter((e) => e.playerIds.includes(playerId)).map((e) => e.id));
  return state.matches
    .filter((m) => m.status === 'done' && ((m.a && entryIds.has(m.a)) || (m.b && entryIds.has(m.b))))
    .map((m) => ({ match: m, side: (m.a && entryIds.has(m.a) ? 'a' : 'b') as 'a' | 'b' }))
    .sort((x, y) => x.match.number - y.match.number);
}
