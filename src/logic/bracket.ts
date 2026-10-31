import type { Match, Side, FinishType, Rubber } from '../types';
import { uid } from './util';

export function newMatch(p: Partial<Match> & Pick<Match, 'eventId' | 'stage' | 'round' | 'slot'>): Match {
  return {
    id: uid('m'),
    group: -1,
    number: 0,
    a: null,
    b: null,
    nextMatchId: null,
    nextSide: null,
    loserNextMatchId: null,
    loserNextSide: null,
    status: 'waiting',
    court: null,
    games: [],
    finish: 'normal',
    rubbers: [],
    ...p,
  };
}

/** 位置の並びからトーナメントの試合を作る */
export function buildKnockout(eventId: string, slots: (string | null)[], thirdPlace: boolean, stage: 'main' = 'main'): Match[] {
  const size = slots.length;
  const rounds = Math.log2(size);
  const byRound: Match[][] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size >> r;
    const list: Match[] = [];
    for (let s = 0; s < count; s++) list.push(newMatch({ eventId, stage, round: r, slot: s }));
    byRound.push(list);
  }
  for (let r = 0; r < rounds - 1; r++) {
    byRound[r].forEach((m, s) => {
      m.nextMatchId = byRound[r + 1][s >> 1].id;
      m.nextSide = s % 2 === 0 ? 'a' : 'b';
    });
  }
  byRound[0].forEach((m, s) => {
    m.a = slots[s * 2];
    m.b = slots[s * 2 + 1];
  });
  const all = byRound.flat();
  if (thirdPlace && rounds >= 2) {
    const third = newMatch({ eventId, stage: 'third', round: rounds, slot: -1 });
    byRound[rounds - 2].forEach((m, s) => {
      m.loserNextMatchId = third.id;
      m.loserNextSide = s % 2 === 0 ? 'a' : 'b';
    });
    all.push(third);
  }
  resolveByes(all);
  return all;
}

/** 片方が空の1回戦を不戦勝（BYE）として勝ち上がらせる */
export function resolveByes(matches: Match[]): void {
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const m of matches) {
    if (m.stage !== 'main' || m.round !== 1) continue;
    if (m.a && m.b) continue;
    m.status = 'bye';
    const w: Side | null = m.a ? 'a' : m.b ? 'b' : null;
    if (w) {
      m.winner = w;
      const next = m.nextMatchId ? byId.get(m.nextMatchId) : undefined;
      if (next && m.nextSide) next[m.nextSide] = m[w];
    }
  }
}

/** 総当たりの対戦順（サークル方式） */
export function roundRobin<T>(items: T[]): [T, T][][] {
  const list: (T | null)[] = items.slice();
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [T, T][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[i];
      const y = list[n - 1 - i];
      if (x !== null && y !== null) pairs.push(r % 2 === 0 ? [x, y] : [y, x]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

export function buildLeague(eventId: string, groups: string[][]): Match[] {
  const out: Match[] = [];
  groups.forEach((ids, g) => {
    roundRobin(ids).forEach((pairs, r) => {
      pairs.forEach(([a, b], s) => out.push(newMatch({ eventId, stage: 'league', round: r + 1, slot: s, group: g, a, b })));
    });
  });
  return out;
}

export interface ResultInput {
  games: [number, number][];
  winner: Side;
  finish: FinishType;
  rubbers?: Rubber[];
  endedAt?: number;
}

/** 結果を記録して勝者・敗者を次の試合へ送る。問題があればエラーメッセージを返す */
export function applyResult(matches: Match[], matchId: string, r: ResultInput): string | null {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const m = byId.get(matchId);
  if (!m) return '試合が見つかりません';
  if (!m.a || !m.b) return '対戦者が揃っていません';
  const err = canChangeDownstream(m, byId);
  if (err && m.winner && m.winner !== r.winner) return err;
  m.games = r.games;
  m.winner = r.winner;
  m.finish = r.finish;
  if (r.rubbers) m.rubbers = r.rubbers;
  m.status = 'done';
  m.endedAt = r.endedAt ?? m.endedAt ?? Date.now();
  if (!m.startedAt) m.startedAt = m.endedAt;
  const loser: Side = r.winner === 'a' ? 'b' : 'a';
  send(byId, m.nextMatchId, m.nextSide, m[r.winner]);
  send(byId, m.loserNextMatchId, m.loserNextSide, m[loser]);
  return null;
}

function send(byId: Map<string, Match>, id: string | null, side: Side | null, entry: string | null) {
  if (!id || !side) return;
  const n = byId.get(id);
  if (n) n[side] = entry;
}

function canChangeDownstream(m: Match, byId: Map<string, Match>): string | null {
  for (const id of [m.nextMatchId, m.loserNextMatchId]) {
    const n = id ? byId.get(id) : undefined;
    if (n && n.status !== 'waiting') return `次の試合（No.${n.number}）が開始済みのため変更できません`;
  }
  return null;
}

/** 結果を取り消す（次の試合が始まっていなければ） */
export function clearResult(matches: Match[], matchId: string): string | null {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const m = byId.get(matchId);
  if (!m) return '試合が見つかりません';
  const err = canChangeDownstream(m, byId);
  if (err) return err;
  send(byId, m.nextMatchId, m.nextSide, null);
  send(byId, m.loserNextMatchId, m.loserNextSide, null);
  m.games = [];
  m.winner = undefined;
  m.finish = 'normal';
  m.status = 'waiting';
  m.court = null;
  m.calledAt = m.startedAt = m.endedAt = undefined;
  m.rubbers = m.rubbers.map((r) => ({ ...r, games: [], winner: undefined, finish: 'normal' }));
  return null;
}

/** 試合番号を振る：リーグ→トーナメント、回戦ごとに全種目を順に */
export function numberMatches(matches: Match[], eventOrder: string[], startFrom = 1, onlyUnnumbered = false): void {
  const idx = (id: string) => {
    const i = eventOrder.indexOf(id);
    return i < 0 ? 999 : i;
  };
  const stageOrder = (m: Match) => (m.stage === 'league' ? 0 : 1);
  const list = matches
    .filter((m) => m.status !== 'bye' && (!onlyUnnumbered || !m.number))
    .sort(
      (x, y) =>
        stageOrder(x) - stageOrder(y) ||
        x.round - y.round ||
        idx(x.eventId) - idx(y.eventId) ||
        x.group - y.group ||
        x.slot - y.slot,
    );
  let n = startFrom;
  for (const m of matches) if (m.status === 'bye') m.number = 0;
  for (const m of list) m.number = n++;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return '決勝';
  if (fromEnd === 1) return '準決勝';
  if (fromEnd === 2) return '準々決勝';
  return `${round}回戦`;
}
