import type { AppState, Entry, Match, Player, TEvent } from '../types';
import { roundName } from './bracket';

export function playerMap(state: AppState): Map<string, Player> {
  return new Map(state.players.map((p) => [p.id, p]));
}

export function entryName(state: AppState, e: Entry | undefined, pm = playerMap(state)): string {
  if (!e) return '';
  if (e.teamName) return e.teamName;
  return e.playerIds.map((id) => pm.get(id)?.name ?? '?').join('・');
}

export function entryKana(state: AppState, e: Entry | undefined, pm = playerMap(state)): string {
  if (!e) return '';
  if (e.teamName) return e.teamName;
  return e.playerIds.map((id) => pm.get(id)?.kana || pm.get(id)?.name || '').join('、');
}

export function entryAffiliation(state: AppState, e: Entry | undefined, pm = playerMap(state)): string {
  if (!e) return '';
  if (e.teamName) {
    const affs = [...new Set(e.playerIds.map((id) => pm.get(id)?.affiliation).filter(Boolean))];
    return affs.length === 1 ? affs[0]! : '';
  }
  const affs = [...new Set(e.playerIds.map((id) => pm.get(id)?.affiliation ?? ''))];
  return affs.join('・');
}

export function entryById(state: AppState, id: string | null): Entry | undefined {
  return id ? state.entries.find((e) => e.id === id) : undefined;
}

export function totalRounds(state: AppState, eventId: string): number {
  return Math.max(0, ...state.matches.filter((m) => m.eventId === eventId && m.stage === 'main').map((m) => m.round));
}

export function matchRoundLabel(state: AppState, m: Match): string {
  if (m.stage === 'league') return `予選${m.group >= 0 ? String.fromCharCode(65 + m.group) + 'グループ' : ''}`;
  if (m.stage === 'third') return '3位決定戦';
  return roundName(m.round, totalRounds(state, m.eventId));
}

export function eventById(state: AppState, id: string): TEvent | undefined {
  return state.events.find((e) => e.id === id);
}

export function groupLabel(g: number): string {
  return String.fromCharCode(65 + g);
}
