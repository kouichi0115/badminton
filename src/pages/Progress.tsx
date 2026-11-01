import { useEffect, useState } from 'react';
import { useAppState } from '../store';
import { Empty } from '../components/common';
import { ScoreDialog } from '../components/ScoreDialog';
import { OrderDialog } from '../components/OrderDialog';
import { orderStatus } from '../logic/team';
import { callMatch, returnToWaiting, startMatch } from '../actions';
import { candidates, freeCourts, simulate } from '../logic/scheduler';
import { entryAffiliation, entryById, entryName, matchRoundLabel, playerMap } from '../logic/names';
import { callText } from '../logic/call';
import { speak } from '../logic/speech';
import { fmtMinutes } from '../logic/util';
import type { AppState, Match } from '../types';

function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function loadAutoSpeak() {
  try {
    return localStorage.getItem('autoSpeak') === '1';
  } catch {
    return false;
  }
}

export default function ProgressPage() {
  const s = useAppState();
  const now = useNow();
  const [editing, setEditing] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(loadAutoSpeak);
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState<Record<number, string>>({});
  const pm = playerMap(s);

  if (!s.matches.length) return <Empty>組み合わせがまだありません。<a href="#draw">組み合わせ</a>を作成してください。</Empty>;

  const cands = candidates(s, now);
  const free = freeCourts(s);
  const active = s.matches.filter((m) => m.status === 'called' || m.status === 'playing');
  const real = s.matches.filter((m) => m.status !== 'bye');
  const done = real.filter((m) => m.status === 'done').length;
  const notReady = real.filter((m) => m.status === 'waiting' && (!m.a || !m.b)).length;

  // 残り試合の終了見込み
  const remaining = real.filter((m) => m.status !== 'done');
  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const est = remaining.length ? Math.max(...simulate({ ...s, matches: s.matches.map((m) => (m.status === 'done' ? { ...m, status: 'bye' } : m)) } as AppState, nowMin).map((p) => p.end)) : 0;

  const doCall = (m: Match, court: number) => {
    callMatch(m.id, court);
    if (autoSpeak) speak(callText(s, { ...m, court }, true), s.tournament.speechRate, s.tournament.voiceName);
    setPick((p) => ({ ...p, [court]: '' }));
  };

  const editingMatch = s.matches.find((m) => m.id === editing);
  const orderingMatch = s.matches.find((m) => m.id === ordering);
  const found = search ? s.matches.find((m) => String(m.number) === search.trim()) : undefined;

  const vs = (m: Match) => (
    <div className="vs">
      <div>
        <b>{entryName(s, entryById(s, m.a), pm)}</b> <span className="aff">{entryAffiliation(s, entryById(s, m.a), pm)}</span>
      </div>
      <div className="sep">対</div>
      <div>
        <b>{entryName(s, entryById(s, m.b), pm)}</b> <span className="aff">{entryAffiliation(s, entryById(s, m.b), pm)}</span>
      </div>
    </div>
  );
  const evName = (m: Match) => s.events.find((e) => e.id === m.eventId)?.name ?? '';
  const isTeam = (m: Match) => s.events.find((e) => e.id === m.eventId)?.type === 'team';
  const orderTag = (m: Match) => {
    const st = orderStatus(m.rubbers);
    if (st.a && st.b) return <span className="tag ok">オーダー入力済</span>;
    if (st.a || st.b) return <span className="tag warn">オーダー片方のみ</span>;
    return <span className="tag danger">オーダー未入力</span>;
  };
  const orderButton = (m: Match) => (
    <button className="secondary small" onClick={() => setOrdering(m.id)}>
      オーダー
    </button>
  );
  const teamUpcoming = s.matches
    .filter((m) => isTeam(m) && m.a && m.b && m.status !== 'done' && m.status !== 'bye')
    .sort((x, y) => x.number - y.number);

  return (
    <>
      <section className="panel">
        <div className="row">
          <span>
            終了 <b>{done}</b> / {real.length} 試合
          </span>
          <span>
            進行中 <b>{active.length}</b>
          </span>
          <span>
            待機 <b>{cands.length}</b>
          </span>
          <span className="muted">対戦者待ち {notReady}</span>
          {est > 0 && <span className="tag info">終了見込み {fmtMinutes(est)}</span>}
          <span className="spacer" />
          <label className="row small" style={{ gap: 4 }}>
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => {
                setAutoSpeak(e.target.checked);
                try {
                  localStorage.setItem('autoSpeak', e.target.checked ? '1' : '0');
                } catch {
                  /* 保存できなくても動作する */
                }
              }}
            />
            コール時に読み上げ
          </label>
          <input placeholder="試合番号で結果入力" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 150 }} inputMode="numeric" />
          {found && (
            <button className="small" disabled={!found.a || !found.b} onClick={() => (setEditing(found.id), setSearch(''))}>
              No.{found.number} を開く
            </button>
          )}
        </div>
      </section>

      <section className="courts" style={{ marginBottom: 16 }}>
        {Array.from({ length: s.tournament.courts }, (_, i) => i + 1).map((c) => {
          const m = active.find((x) => x.court === c);
          if (m) {
            const since = m.status === 'playing' ? m.startedAt : m.calledAt;
            return (
              <div key={c} className={`court ${m.status}`}>
                <div className="court-head">
                  <span className="court-no">第{c}コート</span>
                  <span className={`tag ${m.status === 'playing' ? 'ok' : 'warn'}`}>{m.status === 'playing' ? '試合中' : 'コール済'}</span>
                </div>
                <div className="small muted">
                  No.{m.number} {evName(m)} {matchRoundLabel(s, m)}
                </div>
                {vs(m)}
                {isTeam(m) && (
                  <div className="row small" style={{ gap: 6 }}>
                    {orderTag(m)}
                    {orderButton(m)}
                  </div>
                )}
                <div className="row small">
                  <span className="elapsed">{since ? `${Math.max(0, Math.floor((now - since) / 60000))}分経過` : ''}</span>
                  <span className="spacer" />
                  <button className="ghost small" title="もう一度読み上げ" onClick={() => speak(callText(s, m, true), s.tournament.speechRate, s.tournament.voiceName)}>
                    📢
                  </button>
                </div>
                <div className="row">
                  {m.status === 'called' && (
                    <button className="secondary small" onClick={() => startMatch(m.id)}>
                      開始
                    </button>
                  )}
                  <button className="small" onClick={() => setEditing(m.id)}>
                    結果入力
                  </button>
                  <span className="spacer" />
                  <button className="ghost small" onClick={() => returnToWaiting(m.id)} title="コールを取り消して待機に戻す">
                    戻す
                  </button>
                </div>
              </div>
            );
          }
          const options = cands.filter((x) => !x.busy);
          const chosen = options.find((x) => x.match.id === pick[c]) ?? options[0];
          return (
            <div key={c} className="court">
              <div className="court-head">
                <span className="court-no">第{c}コート</span>
                <span className="tag">空き</span>
              </div>
              {chosen ? (
                <>
                  <select value={chosen.match.id} onChange={(e) => setPick((p) => ({ ...p, [c]: e.target.value }))} aria-label={`第${c}コートに入れる試合`}>
                    {options.slice(0, 30).map((x) => (
                      <option key={x.match.id} value={x.match.id}>
                        No.{x.match.number} {evName(x.match)} {x.restLeft ? `（休憩あと${x.restLeft}分）` : ''}
                      </option>
                    ))}
                  </select>
                  {vs(chosen.match)}
                  {isTeam(chosen.match) && (
                    <div className="row small" style={{ gap: 6 }}>
                      {orderTag(chosen.match)}
                      {orderButton(chosen.match)}
                    </div>
                  )}
                  {chosen.restLeft > 0 && <span className="tag warn">休憩あと{chosen.restLeft}分</span>}
                  <div className="row">
                    <button onClick={() => doCall(chosen.match, c)}>コール</button>
                  </div>
                </>
              ) : (
                <span className="muted small">入れられる試合がありません</span>
              )}
            </div>
          );
        })}
      </section>

      {teamUpcoming.length > 0 && (
        <section className="panel">
          <h3>団体戦のオーダー</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            試合前に各チームのオーダーを入力すると、審判用紙・オーダー用紙に選手名が印字されます。
          </p>
          <div className="table-wrap">
            <table className="list">
              <tbody>
                {teamUpcoming.map((m) => {
                  const st = orderStatus(m.rubbers);
                  return (
                    <tr key={m.id}>
                      <td className="num">No.{m.number}</td>
                      <td>
                        {evName(m)} {matchRoundLabel(s, m)}
                      </td>
                      <td>
                        {entryName(s, entryById(s, m.a), pm)} {st.a ? '✓' : ''} <span className="muted">対</span> {entryName(s, entryById(s, m.b), pm)} {st.b ? '✓' : ''}
                      </td>
                      <td>{orderTag(m)}</td>
                      <td>{orderButton(m)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <h3>待機中の試合</h3>
        {cands.length === 0 ? (
          <p className="muted">対戦者が決まっている待機中の試合はありません。</p>
        ) : (
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th className="num">No</th>
                  <th>種目</th>
                  <th>回戦</th>
                  <th>対戦</th>
                  <th>状態</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cands.map(({ match: m, busy, restLeft }) => (
                  <tr key={m.id}>
                    <td className="num">{m.number}</td>
                    <td>{evName(m)}</td>
                    <td>{matchRoundLabel(s, m)}</td>
                    <td>
                      {entryName(s, entryById(s, m.a), pm)} <span className="muted">対</span> {entryName(s, entryById(s, m.b), pm)}
                    </td>
                    <td>
                      {busy ? <span className="tag danger">出場中の選手あり</span> : restLeft ? <span className="tag warn">休憩あと{restLeft}分</span> : <span className="tag ok">入れます</span>}{' '}
                      {isTeam(m) && orderTag(m)}
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                        {free.length > 0 && !busy && (
                          <select
                            value=""
                            onChange={(e) => e.target.value && doCall(m, Number(e.target.value))}
                            aria-label={`No.${m.number} のコート`}
                          >
                            <option value="">コートへ…</option>
                            {free.map((c) => (
                              <option key={c} value={c}>
                                第{c}コート
                              </option>
                            ))}
                          </select>
                        )}
                        {isTeam(m) && orderButton(m)}
                        <button className="secondary small" onClick={() => setEditing(m.id)}>
                          結果
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RecentResults state={s} onOpen={setEditing} />

      {editingMatch && <ScoreDialog key={editingMatch.id} state={s} match={editingMatch} onClose={() => setEditing(null)} />}
      {orderingMatch && <OrderDialog key={orderingMatch.id} state={s} match={orderingMatch} onClose={() => setOrdering(null)} />}
    </>
  );
}

function RecentResults({ state: s, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const pm = playerMap(s);
  const list = s.matches
    .filter((m) => m.status === 'done')
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 15);
  if (!list.length) return null;
  return (
    <section className="panel">
      <h3>最近の結果</h3>
      <div className="table-wrap">
        <table className="list">
          <tbody>
            {list.map((m) => {
              const w = entryById(s, m.winner ? m[m.winner] : null);
              const l = entryById(s, m.winner === 'a' ? m.b : m.a);
              return (
                <tr key={m.id}>
                  <td className="num">No.{m.number}</td>
                  <td>{s.events.find((e) => e.id === m.eventId)?.name}</td>
                  <td>
                    <b>{entryName(s, w, pm)}</b> <span className="muted">勝</span> {entryName(s, l, pm)}
                  </td>
                  <td className="small">
                    {m.finish === 'walkover' ? '不戦勝' : m.finish === 'retired' ? '途中棄権' : m.rubbers.length ? `${m.rubbers.filter((r) => r.winner === m.winner).length}-${m.rubbers.filter((r) => r.winner && r.winner !== m.winner).length}` : m.games.map(([a, b]) => (m.winner === 'a' ? `${a}-${b}` : `${b}-${a}`)).join(' ')}
                  </td>
                  <td>
                    <button className="ghost small" onClick={() => onOpen(m.id)}>
                      修正
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
