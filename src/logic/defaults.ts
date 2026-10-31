import type { AppState, TEvent } from '../types';
import { uid } from './util';

export function defaultState(): AppState {
  return {
    version: 1,
    tournament: {
      name: '',
      date: new Date().toISOString().slice(0, 10),
      venue: '',
      organizer: '',
      courts: 6,
      restMinutes: 10,
      startTime: '09:00',
      maxEventsPerPlayer: 2,
      callTemplate:
        '試合のお呼び出しをいたします。第{コート}コート、試合番号{番号}番、{種目}{回戦}、{A所属}、{A}さん、対、{B所属}、{B}さん。第{コート}コートへお入りください。',
      speechRate: 1,
      voiceName: '',
      certificate: {
        orientation: 'vertical',
        title: '賞状',
        body: 'あなたは{大会名}{種目}において頭書の成績を収められました よってこれを賞します',
        organizer: '',
        dateText: '',
        showAffiliation: true,
      },
      paidAffiliations: [],
    },
    players: [],
    events: [],
    entries: [],
    matches: [],
  };
}

export function newEvent(type: TEvent['type'], name?: string): TEvent {
  const label = { singles: 'シングルス', doubles: 'ダブルス', team: '団体戦' }[type];
  return {
    id: uid('e'),
    name: name ?? label,
    type,
    format: 'tournament',
    rules: { points: 21, cap: 30, gamesToWin: 2 },
    thirdPlace: false,
    groupCount: 4,
    advancePerGroup: 1,
    fee: 0,
    rubbers:
      type === 'team'
        ? [
            { label: '第1ダブルス', type: 'doubles' },
            { label: '第1シングルス', type: 'singles' },
            { label: '第2ダブルス', type: 'doubles' },
          ]
        : [],
    stopWhenDecided: true,
    estMinutes: type === 'team' ? 60 : 20,
  };
}
