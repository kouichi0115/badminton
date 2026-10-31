import type { AppState, Match } from '../types';
import { entryAffiliation, entryById, entryName, playerMap } from '../logic/names';
import { gameCount, scoreText } from '../logic/score';
import { standings } from '../logic/league';
import { leagueGroups } from '../actions';
import { groupLabel } from '../logic/names';

interface Props {
  state: AppState;
  eventId: string;
  rowHeight?: number;
  print?: boolean;
  onMatchClick?: (m: Match) => void;
}

/** トーナメント表（左から右へ） */
export function Bracket({ state, eventId, rowHeight = 26, print, onMatchClick }: Props) {
  const main = state.matches.filter((m) => m.eventId === eventId && m.stage === 'main');
  if (!main.length) return null;
  const rounds = Math.max(...main.map((m) => m.round));
  const size = 2 ** rounds;
  const at = new Map(main.map((m) => [`${m.round}-${m.slot}`, m]));
  const pm = playerMap(state);
  const h = rowHeight;
  const nameW = print ? 250 : 270;
  const colW = print ? Math.max(48, Math.min(80, 420 / rounds)) : 78;
  const width = nameW + colW * rounds + 220;
  const height = size * h + 10;
  const red = '#d1261d';
  const black = '#333';

  const yCache = new Map<string, number>();
  const y = (r: number, s: number): number => {
    const k = `${r}-${s}`;
    if (yCache.has(k)) return yCache.get(k)!;
    const v = r === 0 ? (s + 0.5) * h + 5 : (y(r - 1, 2 * s) + y(r - 1, 2 * s + 1)) / 2;
    yCache.set(k, v);
    return v;
  };
  const X = (r: number) => nameW + r * colW;

  const lines: JSX.Element[] = [];
  const labels: JSX.Element[] = [];
  // 子 c（round r-1）の出力線が、試合(r, c>>1)の勝者側か
  const childWon = (r: number, c: number) => {
    const m = at.get(`${r}-${c >> 1}`);
    if (!m?.winner) return false;
    return (c % 2 === 0 ? 'a' : 'b') === m.winner;
  };

  // 名前
  for (let i = 0; i < size; i++) {
    const m = at.get(`1-${i >> 1}`);
    const id = m ? (i % 2 === 0 ? m.a : m.b) : null;
    const e = entryById(state, id);
    const yy = y(0, i);
    const bye = m?.status === 'bye' && !id;
    labels.push(
      <g key={`n${i}`}>
        <text x={4} y={yy + 4} fontSize={print ? 10 : 11} fill="#888">
          {i + 1}
        </text>
        <text x={28} y={yy + 4} fontSize={print ? 11.5 : 13} fontWeight={600}>
          {bye ? '' : entryName(state, e, pm)}
        </text>
        <text x={nameW - 4} y={yy + 4} fontSize={print ? 9.5 : 11} fill="#555" textAnchor="end">
          {bye ? '' : e ? `（${entryAffiliation(state, e, pm)}）` : ''}
        </text>
      </g>,
    );
    if (!bye) lines.push(<line key={`l0-${i}`} x1={nameW - (e ? 0 : 0)} x2={X(0) + 0.01} y1={yy} y2={yy} stroke={black} />);
  }

  for (let r = 1; r <= rounds; r++) {
    for (let s = 0; s < size >> r; s++) {
      const m = at.get(`${r}-${s}`);
      const ya = y(r - 1, 2 * s);
      const yb = y(r - 1, 2 * s + 1);
      const ym = (ya + yb) / 2;
      const x0 = X(r - 1);
      const x1 = X(r);
      const isBye = m?.status === 'bye';
      const aWon = childWon(r, 2 * s);
      const bWon = childWon(r, 2 * s + 1);
      const aExists = !(r === 1 && isBye && !m?.a);
      const bExists = !(r === 1 && isBye && !m?.b);
      if (aExists) lines.push(<line key={`ha${r}-${s}`} x1={x0} x2={x1} y1={ya} y2={ya} stroke={aWon ? red : black} strokeWidth={aWon ? 2.5 : 1} />);
      if (bExists) lines.push(<line key={`hb${r}-${s}`} x1={x0} x2={x1} y1={yb} y2={yb} stroke={bWon ? red : black} strokeWidth={bWon ? 2.5 : 1} />);
      if (isBye) {
        // 不戦勝：縦線なしで次へ
        const yy = m?.a ? ya : yb;
        lines.push(<line key={`bv${r}-${s}`} x1={x1} x2={x1} y1={yy} y2={ym} stroke={red} strokeWidth={2.5} />);
        continue;
      }
      lines.push(<line key={`va${r}-${s}`} x1={x1} x2={x1} y1={ya} y2={ym} stroke={aWon ? red : black} strokeWidth={aWon ? 2.5 : 1} />);
      lines.push(<line key={`vb${r}-${s}`} x1={x1} x2={x1} y1={ym} y2={yb} stroke={bWon ? red : black} strokeWidth={bWon ? 2.5 : 1} />);
      if (m) {
        labels.push(
          <g key={`m${m.id}`} style={{ cursor: onMatchClick ? 'pointer' : undefined }} onClick={() => onMatchClick?.(m)}>
            <rect x={x1 - colW + 2} y={ya} width={colW - 2} height={yb - ya} fill="transparent" />
            <text x={x1 - 3} y={ym + 4} fontSize={9.5} fill="#2459b8" textAnchor="end">
              {m.number ? `${m.number}` : ''}
            </text>
            {m.games.length > 0 && (
              <text x={x1 + 3} y={ym + (aWon ? -4 : 12)} fontSize={8.5} fill="#444">
                {m.finish === 'walkover' ? '不戦' : m.finish === 'retired' ? '棄権' : `${gameCount(m.games).join('-')}`}
              </text>
            )}
          </g>,
        );
      }
    }
  }
  const final = at.get(`${rounds}-0`);
  const fy = y(rounds, 0);
  const champ = final?.winner ? entryById(state, final[final.winner]) : undefined;
  lines.push(<line key="champ" x1={X(rounds)} x2={X(rounds) + 24} y1={fy} y2={fy} stroke={champ ? red : black} strokeWidth={champ ? 2.5 : 1} />);
  if (champ)
    labels.push(
      <text key="champname" x={X(rounds) + 28} y={fy + 4} fontSize={12} fontWeight={700} fill={red}>
        {entryName(state, champ, pm)}
      </text>,
    );

  const third = state.matches.find((m) => m.eventId === eventId && m.stage === 'third');
  return (
    <div className="bracket-wrap">
      <svg className="bracket" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {lines}
        {labels}
      </svg>
      {third && (
        <div className="small" style={{ marginTop: 4 }}>
          3位決定戦 No.{third.number}：{entryName(state, entryById(state, third.a), pm) || '（準決勝敗者）'} 対 {entryName(state, entryById(state, third.b), pm) || '（準決勝敗者）'}
          {third.winner && ` → 勝者 ${entryName(state, entryById(state, third[third.winner]), pm)} ${scoreText(third.games)}`}
        </div>
      )}
    </div>
  );
}

/** リーグの星取表 */
export function LeagueTables({ state, eventId, onMatchClick }: { state: AppState; eventId: string; onMatchClick?: (m: Match) => void }) {
  const groups = leagueGroups(state, eventId);
  const lm = state.matches.filter((m) => m.eventId === eventId && m.stage === 'league');
  const pm = playerMap(state);
  if (!lm.length) return null;
  return (
    <>
      {groups.map((ids, g) => {
        if (!ids.length) return null;
        const gm = lm.filter((m) => m.group === g);
        const st = standings(ids, gm);
        const rankOf = new Map(st.map((x) => [x.entryId, x]));
        return (
          <div key={g} className="table-wrap">
            {groups.length > 1 && <h4>{groupLabel(g)}グループ</h4>}
            <table className="league-grid">
              <thead>
                <tr>
                  <th></th>
                  {ids.map((id, i) => (
                    <th key={id} title={entryName(state, entryById(state, id), pm)}>
                      {i + 1}
                    </th>
                  ))}
                  <th>勝敗</th>
                  <th>得失G</th>
                  <th>得失点</th>
                  <th>順位</th>
                </tr>
              </thead>
              <tbody>
                {ids.map((rid, ri) => {
                  const r = rankOf.get(rid)!;
                  const e = entryById(state, rid);
                  return (
                    <tr key={rid}>
                      <td className="name">
                        {ri + 1}. <b>{entryName(state, e, pm)}</b> <span className="muted small">{entryAffiliation(state, e, pm)}</span>
                      </td>
                      {ids.map((cid) => {
                        if (cid === rid) return <td key={cid} className="diag" />;
                        const m = gm.find((x) => (x.a === rid && x.b === cid) || (x.a === cid && x.b === rid));
                        if (!m) return <td key={cid} />;
                        const flip = m.b === rid;
                        const won = m.winner && m[m.winner] === rid;
                        const units = m.rubbers.length ? m.rubbers.filter((x) => x.winner).map((x) => x.winner) : m.games.map(([a, b]) => (a > b ? 'a' : 'b'));
                        const wa = units.filter((u) => u === 'a').length;
                        const wb = units.length - wa;
                        return (
                          <td key={cid} onClick={() => onMatchClick?.(m)} style={{ cursor: onMatchClick ? 'pointer' : undefined }}>
                            {m.status === 'done' ? (
                              <span className={won ? 'win' : ''}>
                                {won ? '○' : '●'} {flip ? `${wb}-${wa}` : `${wa}-${wb}`}
                              </span>
                            ) : (
                              <span className="muted small">No.{m.number}</span>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        {r.wins}勝{r.losses}敗
                      </td>
                      <td>{r.gamesFor - r.gamesAgainst}</td>
                      <td>{r.pointsFor - r.pointsAgainst}</td>
                      <td>
                        <b>{r.played ? r.rank : ''}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
