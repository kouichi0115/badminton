import { useSyncExternalStore } from 'react';
import { produce, type Draft } from 'immer';
import type { AppState } from './types';
import { defaultState } from './logic/defaults';

const KEY = 'badminton-taikai-v1';
const MAX_UNDO = 50;

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    /* 読み込めない場合は新規 */
  }
  return defaultState();
}

/** 古いデータや欠けた項目を既定値で補う */
export function migrate(data: Partial<AppState>): AppState {
  const d = defaultState();
  return {
    ...d,
    ...data,
    version: 1,
    tournament: { ...d.tournament, ...(data.tournament ?? {}), certificate: { ...d.tournament.certificate, ...(data.tournament?.certificate ?? {}) } },
    players: data.players ?? [],
    events: data.events ?? [],
    entries: data.entries ?? [],
    matches: data.matches ?? [],
  };
}

let state: AppState = typeof localStorage === 'undefined' ? defaultState() : load();
let past: AppState[] = [];
let future: AppState[] = [];
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 保存できない環境 */
  }
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function update(fn: (d: Draft<AppState>) => void) {
  const next = produce(state, fn);
  if (next === state) return;
  past = [...past.slice(-MAX_UNDO + 1), state];
  future = [];
  state = next;
  emit();
}

export function replaceState(s: AppState) {
  past = [...past.slice(-MAX_UNDO + 1), state];
  future = [];
  state = migrate(s);
  emit();
}

export function undo() {
  const prev = past.pop();
  if (!prev) return;
  future.push(state);
  state = prev;
  emit();
}

export function redo() {
  const next = future.pop();
  if (!next) return;
  past.push(state);
  state = next;
  emit();
}

export function canUndo() {
  return past.length > 0;
}
export function canRedo() {
  return future.length > 0;
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
