import type { Draft } from 'immer';
import type { AppState, Entry, FinishType, Match, Player, Rubber, Side } from './types';
import { getState, update } from './store';
import { assignGroups, autoDraw, type DrawItem } from './logic/draw';
import { applyResult, buildKnockout, buildLeague, clearResult, numberMatches } from './logic/bracket';
import { emptyRubbers } from './logic/team';
import { standings } from './logic/league';
import { entryAffiliation, playerMap } from './logic/names';
import { uid } from './logic/util';

type S = Draft<AppState>;

function hasStarted(s: AppState | S, eventId?: string) {
  return s.matches.some((m) => (!eventId || m.eventId === eventId) && m.status !== 'waiting' && m.status !== 'bye');
}

/** 試合番号を振り直す。どこかで試合が始まっていれば、番号のない試合だけに続き番号を振る */
function renumber(s: S) {
  const order = s.events.map((e) => e.id);
  if (hasStarted(s)) {
    const max = Math.max(0, ...s.matches.map((m) => m.number));
    numberMatches(s.matches as Match[], order, max + 1, true);
  } else numberMatches(s.matches as Match[], order);
}

function drawItems(s: AppState, eventId: string): DrawItem[] {
  const pm = playerMap(s);
  return s.entries
    .filter((e) => e.eventId === eventId)
    .map((e) => ({ id: e.id, seed: e.seed, key: entryAffiliation(s, e, pm) }));
}

function attachRubbers(s: S, eventId: string, ms: Match[]) {
  const ev = s.events.find((e) => e.id === eventId);
  if (ev?.type === 'team') ms.forEach((m) => (m.rubbers = emptyRubbers(ev.rubbers)));
}

export function eventLocked(eventId: string): boolean {
  return hasStarted(getState(), eventId) || getState().matches.some((m) => m.eventId === eventId && m.status === 'done');
}

/** トーナメントの自動配置 */
export function generateKnockout(eventId: string, seed = Date.now()) {
  update((s) => {
    const ev = s.events.find((e) => e.id === eventId)!;
    const r = autoDraw(drawItems(s as AppState, eventId), seed);
    s.matches = s.matches.filter((m) => m.eventId !== eventId);
    const ms = buildKnockout(eventId, r.slots, ev.thirdPlace);
    attachRubbers(s, eventId, ms);
    s.matches.push(...ms);
    renumber(s);
  });
}

/** 1回戦の並びを指定してトーナメントを作り直す（手修正） */
export function setSlots(eventId: string, slots: (string | null)[]) {
  update((s) => {
    const ev = s.events.find((e) => e.id === eventId)!;
    s.matches = s.matches.filter((m) => !(m.eventId === eventId && m.stage !== 'league'));
    const ms = buildKnockout(eventId, slots, ev.thirdPlace);
    attachRubbers(s, eventId, ms);
    s.matches.push(...ms);
    renumber(s);
  });
}

export function currentSlots(s: AppState, eventId: string): (string | null)[] {
  const r1 = s.matches.filter((m) => m.eventId === eventId && m.stage === 'main' && m.round === 1).sort((a, b) => a.slot - b.slot);
  return r1.flatMap((m) => [m.a, m.b]);
}

/** リーグのグループ分けと対戦表の作成 */
export function generateLeague(eventId: string, seed = Date.now()) {
  update((s) => {
    const ev = s.events.find((e) => e.id === eventId)!;
    const count = ev.format === 'league' ? Math.max(1, ev.groupCount) : Math.max(1, ev.groupCount);
    const groups = assignGroups(drawItems(s as AppState, eventId), count, seed);
    groups.forEach((ids, g) => ids.forEach((id) => (s.entries.find((e) => e.id === id)!.group = g)));
    s.matches = s.matches.filter((m) => m.eventId !== eventId);
    const ms = buildLeague(eventId, groups);
    attachRubbers(s, eventId, ms);
    s.matches.push(...ms);
    renumber(s);
  });
}

/** 現在のグループ分けのままリーグ戦を作り直す */
export function rebuildLeague(eventId: string) {
  update((s) => {
    const ev = s.events.find((e) => e.id === eventId)!;
    const groups: string[][] = Array.from({ length: Math.max(1, ev.groupCount) }, () => []);
    s.entries.filter((e) => e.eventId === eventId).forEach((e) => groups[Math.min(Math.max(0, e.group), groups.length - 1)].push(e.id));
    s.matches = s.matches.filter((m) => m.eventId !== eventId);
    const ms = buildLeague(eventId, groups);
    attachRubbers(s, eventId, ms);
    s.matches.push(...ms);
    renumber(s);
  });
}

export function leagueGroups(s: AppState, eventId: string): string[][] {
  const ev = s.events.find((e) => e.id === eventId);
  const n = Math.max(1, ev?.groupCount ?? 1, ...s.entries.filter((e) => e.eventId === eventId).map((e) => e.group + 1));
  const groups: string[][] = Array.from({ length: n }, () => []);
  s.entries.filter((e) => e.eventId === eventId && e.group >= 0).forEach((e) => groups[e.group].push(e.id));
  return groups;
}

/** 予選リーグの上位で決勝トーナメントを作る */
export function generateFinals(eventId: string, seed = Date.now()) {
  update((s) => {
    const ev = s.events.find((e) => e.id === eventId)!;
    const groups = leagueGroups(s as AppState, eventId);
    const items: DrawItem[] = [];
    const lm = s.matches.filter((m) => m.eventId === eventId && m.stage === 'league') as Match[];
    groups.forEach((ids, g) => {
      const st = standings(ids, lm.filter((m) => m.group === g));
      st.slice(0, ev.advancePerGroup).forEach((x, rank) => items.push({ id: x.entryId, seed: rank === 0 ? g + 1 : 0, key: `G${g}` }));
    });
    s.matches = s.matches.filter((m) => !(m.eventId === eventId && m.stage !== 'league'));
    const r = autoDraw(items, seed);
    const ms = buildKnockout(eventId, r.slots, ev.thirdPlace);
    attachRubbers(s, eventId, ms);
    s.matches.push(...ms);
    renumber(s);
  });
}

export function clearDraw(eventId: string) {
  update((s) => {
    s.matches = s.matches.filter((m) => m.eventId !== eventId);
    s.entries.forEach((e) => e.eventId === eventId && (e.group = -1));
  });
}

export function renumberAll() {
  update((s) => numberMatches(s.matches as Match[], s.events.map((e) => e.id)));
}

// ---- 進行 ----

export function callMatch(matchId: string, court: number) {
  update((s) => {
    const m = s.matches.find((x) => x.id === matchId)!;
    m.status = 'called';
    m.court = court;
    m.calledAt = Date.now();
  });
}

export function startMatch(matchId: string) {
  update((s) => {
    const m = s.matches.find((x) => x.id === matchId)!;
    m.status = 'playing';
    m.startedAt = Date.now();
  });
}

export function returnToWaiting(matchId: string) {
  update((s) => {
    const m = s.matches.find((x) => x.id === matchId)!;
    m.status = 'waiting';
    m.court = null;
    m.calledAt = m.startedAt = undefined;
  });
}

export function saveResult(matchId: string, games: [number, number][], winner: Side, finish: FinishType, rubbers?: Rubber[]): string | null {
  let err: string | null = null;
  update((s) => {
    err = applyResult(s.matches as Match[], matchId, { games, winner, finish, rubbers });
  });
  return err;
}

export function undoResult(matchId: string): string | null {
  let err: string | null = null;
  update((s) => {
    err = clearResult(s.matches as Match[], matchId);
  });
  return err;
}

export function setRubbers(matchId: string, rubbers: Rubber[]) {
  update((s) => {
    const m = s.matches.find((x) => x.id === matchId)!;
    m.rubbers = rubbers;
  });
}

// ---- 参加者 ----

const norm = (t: string) => t.replace(/[\s　]/g, '');

export function findOrCreatePlayer(s: S, name: string, kana: string, affiliation: string): string {
  const found = s.players.find((p) => norm(p.name) === norm(name) && norm(p.affiliation) === norm(affiliation));
  if (found) {
    if (kana && !found.kana) found.kana = kana;
    return found.id;
  }
  const p: Player = { id: uid('p'), name: name.trim(), kana: kana.trim(), affiliation: affiliation.trim(), gender: '', category: '', note: '' };
  s.players.push(p);
  return p.id;
}

export interface EntryInput {
  teamName?: string;
  players: { name: string; kana: string; affiliation: string }[];
  seed?: number;
}

export function addEntries(eventId: string, inputs: EntryInput[]) {
  update((s) => {
    for (const inp of inputs) {
      const ids = inp.players.filter((p) => p.name.trim()).map((p) => findOrCreatePlayer(s, p.name, p.kana, p.affiliation));
      if (!ids.length && !inp.teamName) continue;
      const e: Entry = { id: uid('n'), eventId, playerIds: ids, teamName: inp.teamName?.trim() ?? '', seed: inp.seed ?? 0, group: -1 };
      s.entries.push(e);
    }
  });
}

/** 使われなくなった選手を削除 */
export function cleanupPlayers(s: S) {
  const used = new Set(s.entries.flatMap((e) => e.playerIds));
  s.players = s.players.filter((p) => used.has(p.id));
}
