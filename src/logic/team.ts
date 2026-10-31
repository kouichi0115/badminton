import type { Rubber, RubberDef, ScoreRules, Side } from '../types';
import { matchWinner } from './score';

export function emptyRubbers(defs: RubberDef[]): Rubber[] {
  return defs.map((d) => ({ label: d.label, type: d.type, a: [], b: [], games: [], finish: 'normal' }));
}

/** 各試合の勝敗を判定し、チームの勝敗を返す */
export function teamResult(rubbers: Rubber[], rules: ScoreRules): { wins: [number, number]; winner: Side | null; decidedAt: number } {
  const need = Math.floor(rubbers.length / 2) + 1;
  let a = 0;
  let b = 0;
  let decidedAt = -1;
  rubbers.forEach((r, i) => {
    const w = r.finish === 'normal' ? matchWinner(r.games, rules).winner : r.winner ?? null;
    if (w === 'a') a++;
    if (w === 'b') b++;
    if (decidedAt < 0 && (a >= need || b >= need)) decidedAt = i;
  });
  return { wins: [a, b], winner: a >= need ? 'a' : b >= need ? 'b' : null, decidedAt };
}

/** 団体戦オーダーの文字列 "複,単,複" を定義に変換 */
export function parseOrder(text: string): RubberDef[] {
  const counts = { singles: 0, doubles: 0 };
  return text
    .split(/[,、\s]+/)
    .filter(Boolean)
    .map((t) => {
      const type: 'singles' | 'doubles' = /複|D|d/.test(t) ? 'doubles' : 'singles';
      counts[type]++;
      return { type, label: `第${counts[type]}${type === 'doubles' ? 'ダブルス' : 'シングルス'}` };
    });
}

export function orderText(defs: RubberDef[]): string {
  return defs.map((d) => (d.type === 'doubles' ? '複' : '単')).join(',');
}
