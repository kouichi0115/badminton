import { nextPow2, rng, shuffle } from './util';

/**
 * ドロー上の各位置に入るシード番号の並び（標準方式）。
 * size=8 → [1,8,5,4,3,6,7,2]（位置0に1シード、位置7に2シード…）
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    const next: number[] = [];
    order.forEach((s, i) => (i % 2 === 0 ? next.push(s, n - s) : next.push(n - s, s)));
    order = next;
  }
  return order;
}

export interface DrawItem {
  id: string;
  seed: number;
  /** 分散させたいグループ（所属など） */
  key: string;
}

export interface DrawResult {
  size: number;
  /** 位置ごとのエントリーID（null=BYE） */
  slots: (string | null)[];
}

/**
 * 自動配置。
 * - シードは標準シード位置へ
 * - BYE は上位シードの相手から順に配置
 * - それ以外は同じ所属ができるだけ早く当たらないように配置
 */
export function autoDraw(items: DrawItem[], seedValue = Date.now(), minSize = 2): DrawResult {
  const rand = rng(seedValue);
  const size = Math.max(minSize, nextPow2(Math.max(2, items.length)));
  const order = seedOrder(size);
  const posOfSeed: number[] = [];
  order.forEach((s, pos) => (posOfSeed[s] = pos));

  const slots: (string | null)[] = new Array(size).fill(undefined);
  const keyAt: (string | null)[] = new Array(size).fill(null);
  const bye = new Array(size).fill(false);

  const seeded = items.filter((i) => i.seed > 0).sort((x, y) => x.seed - y.seed);
  const others = items.filter((i) => !(i.seed > 0));

  // シードを配置（シード番号が重複・飛び番でも順番に詰める）
  seeded.forEach((it, idx) => {
    const pos = posOfSeed[idx + 1];
    slots[pos] = it.id;
    keyAt[pos] = it.key;
  });

  // BYE：シード順位の高い位置の相手に
  const byeCount = size - items.length;
  for (let k = 1; k <= byeCount; k++) {
    const pos = posOfSeed[k];
    const partner = pos ^ 1;
    bye[partner] = true;
    slots[partner] = null;
  }

  // 所属ごとにまとめ、多い所属から配置
  const groups = new Map<string, DrawItem[]>();
  for (const it of shuffle(others, rand)) {
    const k = it.key || `__${it.id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length).flat();

  for (const it of ordered) {
    const free: number[] = [];
    for (let p = 0; p < size; p++) if (slots[p] === undefined && !bye[p]) free.push(p);
    let best: number[] = [];
    let bestScore = Infinity;
    for (const p of free) {
      const s = conflictScore(p, it.key, keyAt, size);
      if (s < bestScore) {
        bestScore = s;
        best = [p];
      } else if (s === bestScore) best.push(p);
    }
    const pos = best[Math.floor(rand() * best.length)];
    slots[pos] = it.id;
    keyAt[pos] = it.key;
  }
  return { size, slots: slots.map((s) => (s === undefined ? null : s)) };
}

/** 同じ key が近く（早い回戦で当たる位置）にあるほど大きい */
function conflictScore(pos: number, key: string, keyAt: (string | null)[], size: number): number {
  if (!key) return 0;
  let score = 0;
  let block = 2;
  let weight = size; // 1回戦で当たる組み合わせを最も重く
  while (block <= size) {
    const start = Math.floor(pos / block) * block;
    let same = 0;
    for (let p = start; p < start + block; p++) if (p !== pos && keyAt[p] === key) same++;
    score += same * weight;
    block *= 2;
    weight = Math.max(1, Math.floor(weight / 2));
  }
  return score;
}

/** 同じ所属どうしが当たる最初の回戦の一覧（対戦回戦検査） */
export function sameKeyMeetings(slots: (string | null)[], keyOf: (id: string) => string): { a: string; b: string; round: number }[] {
  const out: { a: string; b: string; round: number }[] = [];
  const size = slots.length;
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const a = slots[i];
      const b = slots[j];
      if (!a || !b) continue;
      const ka = keyOf(a);
      if (!ka || ka !== keyOf(b)) continue;
      let round = 1;
      while (i >> round !== j >> round) round++;
      out.push({ a, b, round });
    }
  }
  return out.sort((x, y) => x.round - y.round);
}
