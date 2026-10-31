import type { ScoreRules, Side } from '../types';

/** 1ゲームのスコアが正しく終了しているか。終了なら勝者、未終了/不正なら null と理由 */
export function gameWinner(a: number, b: number, r: ScoreRules): { winner: Side | null; error?: string } {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return { winner: null, error: '点数が不正です' };
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const w: Side = a > b ? 'a' : 'b';
  if (hi > r.cap) return { winner: null, error: `${r.cap}点を超えています` };
  if (hi === r.cap && r.cap > r.points) {
    if (lo === r.cap - 1 || hi - lo >= 2) return { winner: w };
    return { winner: null, error: `${hi}-${lo} は終了スコアではありません` };
  }
  if (hi < r.points) return { winner: null, error: `${hi}-${lo} は終了していません` };
  if (r.cap === r.points) {
    if (hi === r.points && lo < hi) return { winner: w };
    return { winner: null, error: '不正なスコアです' };
  }
  if (hi === r.points && hi - lo >= 2) return { winner: w };
  if (hi > r.points && hi - lo === 2) return { winner: w };
  return { winner: null, error: `${hi}-${lo} は終了スコアではありません` };
}

/** 試合全体の判定 */
export function matchWinner(games: [number, number][], r: ScoreRules): { winner: Side | null; error?: string } {
  let wa = 0;
  let wb = 0;
  for (let i = 0; i < games.length; i++) {
    if (wa >= r.gamesToWin || wb >= r.gamesToWin) return { winner: null, error: '勝敗決定後にゲームがあります' };
    const g = gameWinner(games[i][0], games[i][1], r);
    if (!g.winner) return { winner: null, error: `第${i + 1}ゲーム: ${g.error}` };
    if (g.winner === 'a') wa++;
    else wb++;
  }
  if (wa >= r.gamesToWin) return { winner: 'a' };
  if (wb >= r.gamesToWin) return { winner: 'b' };
  return { winner: null, error: '勝敗が決まっていません' };
}

/** "21-15 18-21 21-19" のような文字列を解析 */
export function parseScore(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /(\d+)\s*[-－ー:：]\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

export function scoreText(games: [number, number][], flip = false): string {
  return games.map(([a, b]) => (flip ? `${b}-${a}` : `${a}-${b}`)).join(' ');
}

export function gameCount(games: [number, number][]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [x, y] of games) {
    if (x > y) a++;
    else if (y > x) b++;
  }
  return [a, b];
}
