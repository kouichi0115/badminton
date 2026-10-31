import { describe, it, expect } from 'vitest';
import { gameWinner, matchWinner, parseScore } from './score';
import { autoDraw, seedOrder, sameKeyMeetings } from './draw';
import { applyResult, buildKnockout, buildLeague, clearResult, numberMatches, roundRobin } from './bracket';
import { standings } from './league';
import { teamResult, parseOrder } from './team';
import { parseCSV, toCSV } from './csv';
import { defaultState, newEvent } from './defaults';
import { candidates, simulate } from './scheduler';
import { placements } from './results';
import type { AppState } from '../types';

const R = { points: 21, cap: 30, gamesToWin: 2 };

describe('score', () => {
  it('judges games', () => {
    expect(gameWinner(21, 15, R).winner).toBe('a');
    expect(gameWinner(20, 22, R).winner).toBe('b');
    expect(gameWinner(30, 29, R).winner).toBe('a');
    expect(gameWinner(21, 20, R).winner).toBeNull();
    expect(gameWinner(23, 20, R).winner).toBeNull();
    expect(gameWinner(31, 29, R).winner).toBeNull();
    expect(gameWinner(15, 10, { points: 15, cap: 15, gamesToWin: 1 }).winner).toBe('a');
  });
  it('judges matches', () => {
    expect(matchWinner([[21, 10], [21, 10]], R).winner).toBe('a');
    expect(matchWinner([[21, 10], [10, 21], [19, 21]], R).winner).toBe('b');
    expect(matchWinner([[21, 10]], R).winner).toBeNull();
    expect(matchWinner([[21, 10], [21, 10], [21, 3]], R).winner).toBeNull();
  });
  it('parses score text', () => {
    expect(parseScore('21-15 18－21, 21:19')).toEqual([[21, 15], [18, 21], [21, 19]]);
  });
});

describe('draw', () => {
  it('seed order', () => {
    expect(seedOrder(8)).toEqual([1, 8, 5, 4, 3, 6, 7, 2]);
  });
  it('places seeds, byes and spreads affiliations', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, seed: i < 2 ? i + 1 : 0, key: i % 3 === 0 ? 'X' : `k${i}` }));
    const r = autoDraw(items, 333);
    expect(r.size).toBe(16);
    expect(r.slots[0]).toBe('p0');
    expect(r.slots[15]).toBe('p1');
    expect(r.slots.filter((s) => s === null).length).toBe(3);
    expect(r.slots[1]).toBeNull();
    expect(r.slots[14]).toBeNull();
    expect(new Set(r.slots.filter(Boolean)).size).toBe(13);
    const key = (id: string) => items.find((i) => i.id === id)!.key;
    // X は5人 → 1回戦では当たらず、2回戦で当たるのは1組だけ
    const meet = sameKeyMeetings(r.slots, key);
    expect(meet.every((m) => m.round >= 2)).toBe(true);
    expect(meet.filter((m) => m.round === 2).length).toBe(1);
  });
});

describe('bracket', () => {
  it('builds knockout with byes and advances winners', () => {
    const ms = buildKnockout('e', ['A', null, 'B', 'C', 'D', 'E', null, 'F'], true);
    expect(ms.length).toBe(4 + 2 + 1 + 1);
    const r1 = ms.filter((m) => m.round === 1);
    expect(r1[0].status).toBe('bye');
    const sf1 = ms.find((m) => m.round === 2 && m.slot === 0)!;
    const sf2 = ms.find((m) => m.round === 2 && m.slot === 1)!;
    expect(sf1.a).toBe('A');
    expect(sf2.b).toBe('F');
    expect(applyResult(ms, r1[1].id, { games: [[21, 5], [21, 5]], winner: 'b', finish: 'normal' })).toBeNull();
    expect(sf1.b).toBe('C');
    applyResult(ms, sf1.id, { games: [[21, 5], [21, 5]], winner: 'a', finish: 'normal' });
    const final = ms.find((m) => m.round === 3 && m.stage === 'main')!;
    const third = ms.find((m) => m.stage === 'third')!;
    expect(final.a).toBe('A');
    expect(third.a).toBe('C');
    final.status = 'playing';
    expect(clearResult(ms, sf1.id)).toMatch(/開始済み/);
    final.status = 'waiting';
    expect(clearResult(ms, sf1.id)).toBeNull();
    expect(final.a).toBeNull();
  });
  it('round robin covers all pairs once', () => {
    const rr = roundRobin(['a', 'b', 'c', 'd', 'e']);
    const pairs = rr.flat().map((p) => [...p].sort().join(''));
    expect(pairs.length).toBe(10);
    expect(new Set(pairs).size).toBe(10);
  });
  it('numbers matches round-major', () => {
    const ms = [...buildKnockout('e1', ['a', 'b', 'c', 'd'], false), ...buildKnockout('e2', ['w', 'x', 'y', 'z'], false)];
    numberMatches(ms, ['e1', 'e2']);
    const nums = ms.map((m) => `${m.eventId}-${m.round}-${m.slot}:${m.number}`);
    expect(nums).toContain('e1-1-0:1');
    expect(nums).toContain('e2-1-0:3');
    expect(nums).toContain('e1-2-0:5');
  });
});

describe('league', () => {
  it('ranks by wins then games', () => {
    const ms = buildLeague('e', [['a', 'b', 'c']]);
    const find = (x: string, y: string) => ms.find((m) => (m.a === x && m.b === y) || (m.a === y && m.b === x))!;
    const win = (x: string, y: string, games: [number, number][]) => {
      const m = find(x, y);
      applyResult(ms, m.id, { games: m.a === x ? games : games.map(([p, q]) => [q, p] as [number, number]), winner: m.a === x ? 'a' : 'b', finish: 'normal' });
    };
    win('a', 'b', [[21, 1], [21, 1]]);
    win('b', 'c', [[21, 1], [21, 1]]);
    win('c', 'a', [[21, 19], [21, 19]]);
    const s = standings(['a', 'b', 'c'], ms);
    expect(s.map((x) => x.wins)).toEqual([1, 1, 1]);
    expect(s[0].entryId).toBe('a');
  });
});

describe('team', () => {
  it('decides team result', () => {
    const order = parseOrder('複,単,複');
    expect(order[2].label).toBe('第2ダブルス');
    const rubbers = order.map((o) => ({ ...o, a: [], b: [], games: [] as [number, number][], finish: 'normal' as const }));
    rubbers[0].games = [[21, 10], [21, 10]];
    rubbers[1].games = [[21, 10], [21, 10]];
    const r = teamResult(rubbers, R);
    expect(r.winner).toBe('a');
    expect(r.decidedAt).toBe(1);
  });
});

describe('csv', () => {
  it('round trips', () => {
    const rows = [['氏名', '所属'], ['山田 "太郎"', 'A,B']];
    expect(parseCSV(toCSV(rows))).toEqual(rows);
  });
});

describe('scheduler & results', () => {
  function sample(): AppState {
    const s = defaultState();
    s.tournament.courts = 2;
    const ev = newEvent('singles');
    s.events.push(ev);
    for (let i = 0; i < 8; i++) {
      s.players.push({ id: `p${i}`, name: `選手${i}`, kana: '', affiliation: '', gender: '', category: '', note: '' });
      s.entries.push({ id: `n${i}`, eventId: ev.id, playerIds: [`p${i}`], teamName: '', seed: 0, group: -1 });
    }
    s.matches = buildKnockout(ev.id, s.entries.map((e) => e.id), false);
    numberMatches(s.matches, [ev.id]);
    return s;
  }
  it('suggests ready matches and simulates schedule', () => {
    const s = sample();
    expect(candidates(s).length).toBe(4);
    const plan = simulate(s, 540);
    expect(plan.length).toBe(7);
    const final = plan.find((p) => s.matches.find((m) => m.id === p.matchId)!.round === 3)!;
    expect(final.start).toBeGreaterThanOrEqual(540 + 40 + 10);
  });
  it('computes placements', () => {
    const s = sample();
    const ev = s.events[0].id;
    for (const r of [1, 2, 3])
      for (const m of s.matches.filter((x) => x.round === r)) applyResult(s.matches, m.id, { games: [[21, 0], [21, 0]], winner: 'a', finish: 'normal' });
    const p = placements(s, ev);
    expect(p[0]).toMatchObject({ label: '優勝', entryId: 'n0' });
    expect(p.filter((x) => x.label === '第3位').length).toBe(2);
    expect(p.filter((x) => x.label === 'ベスト8').length).toBe(4);
  });
});
