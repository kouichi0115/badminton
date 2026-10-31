import type { ReactNode } from 'react';

/**
 * ラリーポイント用スコアシート（A4横 297×210mm）。
 * 座標はすべて mm。元ソフトの標準様式と同じ配置で描く。
 */

const MINCHO = "'Yu Mincho','YuMincho','Hiragino Mincho ProN','MS Mincho','IPAMincho',serif";
const GOTHIC = "'Yu Gothic','YuGothic','Hiragino Kaku Gothic ProN','MS Gothic','Meiryo',sans-serif";
const GRAY = '#dcdcdc';

export interface RpSide {
  /** 選手名（シングルスは1人、ダブルスは2人。空欄可） */
  names: string[];
  kanas: string[];
  affiliation: string;
}

export interface RpSheetData {
  tournament: string;
  matchNo: string;
  court: string;
  date: string;
  plannedStart: string;
  eventLabel: string;
  /** 団体戦の試合名（第1ダブルス など） */
  teamOrder: string;
  organizer: string;
  doubles: boolean;
  a: RpSide;
  b: RpSide;
}

/** 文字幅のおおよその見積もり（全角=1、半角=0.55） */
function textWidth(s: string, h: number): number {
  let w = 0;
  for (const ch of s) w += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.55 : 1;
  return w * h;
}

interface TxtProps {
  x: number;
  y: number;
  h: number;
  /** 右端。指定があれば x〜right の中に収める */
  right?: number;
  align?: 'center' | 'start' | 'justify';
  font?: 'mincho' | 'gothic';
  children: string;
}

/** 上端 y に高さ h の文字を置く */
function Txt({ x, y, h, right, align = 'center', font = 'mincho', children }: TxtProps) {
  const text = children ?? '';
  if (!text) return null;
  const base = y + h * 0.88;
  const family = font === 'gothic' ? GOTHIC : MINCHO;
  const est = textWidth(text, h);
  if (!right) {
    return (
      <text x={x} y={base} fontSize={h} fontFamily={family}>
        {text}
      </text>
    );
  }
  const avail = right - x;
  if (align === 'justify' && text.length > 1) {
    return (
      <text x={x} y={base} fontSize={h} fontFamily={family} textLength={avail} lengthAdjust={est > avail ? 'spacingAndGlyphs' : 'spacing'}>
        {text}
      </text>
    );
  }
  const shrink = est > avail ? { textLength: avail, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  if (align === 'start') {
    return (
      <text x={x} y={base} fontSize={h} fontFamily={family} {...shrink}>
        {text}
      </text>
    );
  }
  return (
    <text x={shrink.textLength ? x : (x + right) / 2} y={base} fontSize={h} fontFamily={family} textAnchor={shrink.textLength ? 'start' : 'middle'} {...shrink}>
      {text}
    </text>
  );
}

function L({ x1, y1, x2, y2, w = 0.15 }: { x1: number; y1: number; x2: number; y2: number; w?: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={w} />;
}

function R({ x1, y1, x2, y2, w = 0.3, fill = 'none' }: { x1: number; y1: number; x2: number; y2: number; w?: number; fill?: string }) {
  return <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} stroke={w ? '#000' : 'none'} strokeWidth={w} fill={fill} />;
}

/** 同じ線を dx 間隔で n 本 */
function repeatLines(n: number, dx: number, x: number, y1: number, y2: number, w: number, key: string): ReactNode[] {
  return Array.from({ length: n }, (_, i) => <L key={`${key}${i}`} x1={x + dx * i} y1={y1} x2={x + dx * i} y2={y2} w={w} />);
}

/** 対戦者の枠（左右） */
function PlayerBox({ side, x1, x2, nameX1, nameX2, divider, gray, doubles }: { side: RpSide; x1: number; x2: number; nameX1: number; nameX2: number; divider: number; gray: boolean; doubles: boolean }) {
  return (
    <g>
      {gray && <R x1={x1} y1={23} x2={x2} y2={42} w={0} fill={GRAY} />}
      <R x1={x1} y1={23} x2={x2} y2={42} w={0.3} />
      <L x1={divider} y1={23} x2={divider} y2={42} />
      {doubles ? (
        <>
          <L x1={nameX1 - 2} y1={32.5} x2={nameX2 + 2} y2={32.5} />
          <Txt x={nameX1} y={23.5} h={2.5} right={nameX2}>
            {side.kanas[0] ?? ''}
          </Txt>
          <Txt x={nameX1} y={26.5} h={5} right={nameX2}>
            {side.names[0] ?? ''}
          </Txt>
          <Txt x={nameX1} y={33} h={2.5} right={nameX2}>
            {side.kanas[1] ?? ''}
          </Txt>
          <Txt x={nameX1} y={36} h={5} right={nameX2}>
            {side.names[1] ?? ''}
          </Txt>
        </>
      ) : (
        <>
          <Txt x={nameX1} y={27} h={2.5} right={nameX2}>
            {side.kanas[0] ?? ''}
          </Txt>
          <Txt x={nameX1} y={30} h={5} right={nameX2}>
            {side.names[0] ?? ''}
          </Txt>
        </>
      )}
      <Txt x={x1} y={45} h={4} right={x2} align="justify">
        （　　　　　　　　　）
      </Txt>
      <Txt x={x1 + 4} y={45} h={4} right={x2 - 4}>
        {side.affiliation}
      </Txt>
    </g>
  );
}

/** 1ゲーム分の記入欄 */
function GameBlock({ top, d }: { top: number; d: RpSheetData }) {
  const names = (s: RpSide) => (d.doubles ? [s.names[0] ?? '', s.names[1] ?? ''] : [s.names[0] ?? '']);
  return (
    <g>
      <R x1={11} y1={top + 11} x2={284.6} y2={top + 22} w={0} fill={GRAY} />
      <R x1={11} y1={top + 33} x2={284.6} y2={top + 44} w={0} fill={GRAY} />
      <R x1={11} y1={top} x2={284.6} y2={top + 44} w={0.5} />
      <L x1={11} y1={top + 22} x2={284.6} y2={top + 22} w={0.5} />
      <L x1={11} y1={top + 11} x2={284.6} y2={top + 11} w={0.3} />
      <L x1={11} y1={top + 33} x2={284.6} y2={top + 33} w={0.3} />
      <L x1={49} y1={top} x2={49} y2={top + 22} w={0.3} />
      <L x1={56.6} y1={top} x2={56.6} y2={top + 22} w={0.3} />
      <L x1={269.4} y1={top + 22} x2={269.4} y2={top + 44} w={0.3} />
      {repeatLines(29, 7.6, 64.2, top, top + 22, 0.15, `u${top}`)}
      {repeatLines(33, 7.6, 18.6, top + 22, top + 44, 0.15, `d${top}`)}
      {d.doubles && (
        <>
          <L x1={11} y1={top + 5.5} x2={284.6} y2={top + 5.5} />
          <L x1={11} y1={top + 16.5} x2={284.6} y2={top + 16.5} />
          <L x1={11} y1={top + 27.5} x2={269.4} y2={top + 27.5} />
          <L x1={11} y1={top + 38.5} x2={269.4} y2={top + 38.5} />
        </>
      )}
      {d.doubles ? (
        <>
          {names(d.a).map((n, i) => (
            <Txt key={`a${i}`} x={13} y={top + 1 + 5.5 * i} h={4} right={46}>
              {n}
            </Txt>
          ))}
          {names(d.b).map((n, i) => (
            <Txt key={`b${i}`} x={13} y={top + 12 + 5.5 * i} h={4} right={46}>
              {n}
            </Txt>
          ))}
        </>
      ) : (
        <>
          <Txt x={13} y={top + 3} h={6} right={46}>
            {names(d.a)[0]}
          </Txt>
          <Txt x={13} y={top + 14} h={6} right={46}>
            {names(d.b)[0]}
          </Txt>
        </>
      )}
    </g>
  );
}

export function RpScoreSheet({ d }: { d: RpSheetData }) {
  const leftLabels = ['大会名称', '試合番号', 'コート番号', '日付', '予定開始時刻'];
  const leftValues = [d.tournament, d.matchNo, d.court, d.date, d.plannedStart];
  const rightLabels = ['開始時刻', '終了時刻', '試合時間', 'シャトル数', '主審', 'サービスジャッジ'];
  return (
    <svg className="rp-sheet" viewBox="0 0 297 210" width="297mm" height="210mm" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,-5)">
        <Txt x={115} y={15} h={5} right={180} font="gothic">
          スコアシート
        </Txt>

        {/* 上部左 */}
        {leftLabels.map((t, i) => (
          <g key={t}>
            <Txt x={10} y={15 + 6 * i} h={4} right={29} align="justify">
              {t}
            </Txt>
            <Txt x={29} y={15 + 6 * i} h={4}>
              ：
            </Txt>
            <L x1={32} y1={20 + 6 * i} x2={75} y2={20 + 6 * i} />
            <Txt x={32} y={15.5 + 6 * i} h={4} right={75} align="start">
              {leftValues[i]}
            </Txt>
          </g>
        ))}

        {/* 上部右 */}
        <Txt x={223} y={8} h={6} right={285}>
          {d.eventLabel}
        </Txt>
        {rightLabels.map((t, i) => (
          <g key={t}>
            <Txt x={223} y={15 + 6 * i} h={4} right={244} align="justify">
              {t}
            </Txt>
            <Txt x={244} y={15 + 6 * i} h={4}>
              ：
            </Txt>
            <L x1={247} y1={20 + 6 * i} x2={285} y2={20 + 6 * i} />
          </g>
        ))}

        {/* 対戦者とスコア */}
        <PlayerBox side={d.a} x1={78} x2={124} nameX1={88} nameX2={122} divider={86} gray={false} doubles={d.doubles} />
        <PlayerBox side={d.b} x1={171} x2={217} nameX1={173} nameX2={207} divider={209} gray doubles={d.doubles} />
        <R x1={132} y1={23} x2={163} y2={42} w={0.3} />
        {[26.2, 32.5, 38.8].map((y) => (
          <L key={y} x1={146.5} y1={y} x2={148.5} y2={y} w={0.3} />
        ))}
        <L x1={140} y1={23} x2={140} y2={42} />
        <L x1={155} y1={23} x2={155} y2={42} />
        <L x1={140} y1={29.3} x2={155} y2={29.3} />
        <L x1={140} y1={35.6} x2={155} y2={35.6} />
        {d.teamOrder && (
          <Txt x={128} y={44} h={6} right={167}>
            {d.teamOrder}
          </Txt>
        )}

        {/* ゲーム欄 */}
        {[53, 98, 143].map((top) => (
          <GameBlock key={top} top={top} d={d} />
        ))}

        {/* 下部 */}
        <Txt x={15} y={190} h={4}>
          勝者署名：
        </Txt>
        <Txt x={128} y={190} h={4}>
          主審署名：
        </Txt>
        <Txt x={212} y={190} h={4}>
          レフェリー署名：
        </Txt>
        <L x1={35} y1={195} x2={85} y2={195} />
        <L x1={148} y1={195} x2={200} y2={195} />
        <L x1={244} y1={195} x2={285} y2={195} />
        <Txt x={135} y={197.5} h={3.2} right={285}>
          （凡例）Ｗ：警告　Ｆ：ﾌｫﾙﾄ　Ｄ：失格　Ｓ：中断　Ｉ：ケガ　Ｒ：棄権　レ：ﾚﾌｪﾘｰ
        </Txt>
        <Txt x={15} y={197} h={6} right={110} font="gothic" align="start">
          {d.organizer}
        </Txt>
      </g>
    </svg>
  );
}
