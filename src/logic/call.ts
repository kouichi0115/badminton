import type { AppState, Match } from '../types';
import { entryAffiliation, entryById, entryKana, entryName, matchRoundLabel, playerMap } from './names';
import { fillTemplate } from './speech';

/** コールの文。forSpeech=true ならふりがなで読む */
export function callText(state: AppState, m: Match, forSpeech = false, template = state.tournament.callTemplate): string {
  const pm = playerMap(state);
  const A = entryById(state, m.a);
  const B = entryById(state, m.b);
  const ev = state.events.find((e) => e.id === m.eventId);
  const nm = (e: typeof A) => (forSpeech ? entryKana(state, e, pm) : entryName(state, e, pm)).replace(/・/g, '、');
  return fillTemplate(template, {
    コート: m.court ?? '',
    番号: m.number,
    種目: ev?.name ?? '',
    回戦: matchRoundLabel(state, m),
    A: nm(A),
    B: nm(B),
    A所属: entryAffiliation(state, A, pm).replace(/・/g, '、'),
    B所属: entryAffiliation(state, B, pm).replace(/・/g, '、'),
  });
}
