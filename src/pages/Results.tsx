import { useState } from 'react';
import { useAppState } from '../store';
import { Empty, EventSelect } from '../components/common';
import { Bracket, LeagueTables } from '../components/Bracket';
import { ScoreDialog } from '../components/ScoreDialog';
import { placements, playerRecord } from '../logic/results';
import { entryAffiliation, entryById, entryName, matchRoundLabel, playerMap } from '../logic/names';
import { download, toCSV } from '../logic/csv';
import { fmtTime } from '../logic/util';
import type { AppState, Match } from '../types';

type Sub = 'event' | 'winners' | 'record' | 'matches' | 'analysis';

export default function ResultsPage() {
  const s = useAppState();
  const [sub, setSub] = useState<Sub>('event');
  if (!s.matches.length) return <Empty>組み合わせがまだありません。</Empty>;
  return (
    <>
      <div className="subtabs">
        {(
          [
            ['event', '種目別'],
            ['winners', '入賞者'],
            ['record', '戦歴'],
            ['matches', '試合一覧'],
            ['analysis', '試合時間分析'],
          ] as [Sub, string][]
        ).map(([k, l]) => (
          <button key={k} className={sub === k ? 'active' : ''} onClick={() => setSub(k)}>
            {l}
          </button>
        ))}
      </div>
      {sub === 'event' && <EventResult />}
      {sub === 'winners' && <Winners />}
      {sub === 'record' && <Records />}
      {sub === 'matches' && <MatchList />}
      {sub === 'analysis' && <Analysis />}
    </>
  );
}

function EventResult() {
  const s = useAppState();
  const [eventId, setEventId] = useState(s.events[0]?.id ?? '');
  const [editing, setEditing] = useState<string | null>(null);
  const ev = s.events.find((e) => e.id === eventId) ?? s.events[0];
  const open = (m: Match) => m.a && m.b && m.status !== 'bye' && setEditing(m.id);
  const pl = placements(s, ev.id);
  const pm = playerMap(s);
  const em = s.matches.find((m) => m.id === editing);
  return (
    <>
      <section className="panel">
        <div className="row" style={{ marginBottom: 10 }}>
          <EventSelect events={s.events} value={ev.id} onChange={setEventId} />
          <span className="muted small">試合をクリックすると結果を入力・修正できます</span>
        </div>
        <LeagueTables state={s} eventId={ev.id} onMatchClick={open} />
        <Bracket state={s} eventId={ev.id} onMatchClick={open} />
      </section>
      {pl.length > 0 && (
        <section className="panel">
          <h3>入賞者</h3>
          <table className="list">
            <tbody>
              {pl.map((p, i) => (
                <tr key={i}>
                  <td style={{ width: 100 }}>
                    <b>{p.label}</b>
                  </td>
                  <td>{entryName(s, entryById(s, p.entryId), pm)}</td>
                  <td className="muted">{entryAffiliation(s, entryById(s, p.entryId), pm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {em && <ScoreDialog key={em.id} state={s} match={em} onClose={() => setEditing(null)} />}
    </>
  );
}

function Winners() {
  const s = useAppState();
  const pm = playerMap(s);
  const rows = s.events.flatMap((ev) => placements(s, ev.id, 4).map((p) => ({ ev, p })));
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3>入賞者一覧</h3>
        <span className="spacer" />
        <button
          className="secondary"
          onClick={() =>
            download(
              '入賞者一覧.csv',
              toCSV([['種目', '順位', '氏名', '所属'], ...rows.map(({ ev, p }) => [ev.name, p.label, entryName(s, entryById(s, p.entryId), pm), entryAffiliation(s, entryById(s, p.entryId), pm)])]),
            )
          }
        >
          CSV出力
        </button>
      </div>
      {rows.length === 0 && <p className="muted">まだ決まった入賞者はいません。</p>}
      <table className="list">
        <tbody>
          {rows.map(({ ev, p }, i) => (
            <tr key={i}>
              <td>{ev.name}</td>
              <td>
                <b>{p.label}</b>
              </td>
              <td>{entryName(s, entryById(s, p.entryId), pm)}</td>
              <td className="muted">{entryAffiliation(s, entryById(s, p.entryId), pm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function resultText(m: Match, side: 'a' | 'b'): string {
  if (m.finish === 'walkover') return '不戦';
  if (m.rubbers.length) {
    const w = m.rubbers.filter((r) => r.winner === side).length;
    const l = m.rubbers.filter((r) => r.winner && r.winner !== side).length;
    return `${w}-${l}`;
  }
  const t = m.games.map(([a, b]) => (side === 'a' ? `${a}-${b}` : `${b}-${a}`)).join(' ');
  return m.finish === 'retired' ? `${t} 棄権` : t;
}

function Records() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const pm = playerMap(s);
  const list = q ? s.players.filter((p) => (p.name + p.kana + p.affiliation).replace(/\s/g, '').includes(q.replace(/\s/g, ''))).slice(0, 30) : [];
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 10 }}>
        <input placeholder="氏名・所属で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">選手ごとの全試合の記録を表示します</span>
      </div>
      {list.map((p) => {
        const rec = playerRecord(s, p.id);
        return (
          <div key={p.id} style={{ marginBottom: 14 }}>
            <h4>
              {p.name} <span className="muted small">{p.affiliation}</span> <span className="tag">{rec.filter((r) => r.match.winner === r.side).length}勝{rec.filter((r) => r.match.winner !== r.side).length}敗</span>
            </h4>
            <table className="list">
              <tbody>
                {rec.map(({ match: m, side }) => {
                  const opp = entryById(s, side === 'a' ? m.b : m.a);
                  return (
                    <tr key={m.id}>
                      <td className="num">No.{m.number}</td>
                      <td>{s.events.find((e) => e.id === m.eventId)?.name}</td>
                      <td>{matchRoundLabel(s, m)}</td>
                      <td>{m.winner === side ? <span className="tag ok">勝</span> : <span className="tag danger">負</span>}</td>
                      <td>
                        対 {entryName(s, opp, pm)} <span className="muted small">{entryAffiliation(s, opp, pm)}</span>
                      </td>
                      <td>{resultText(m, side)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rec.length === 0 && <p className="muted small">終了した試合はありません。</p>}
          </div>
        );
      })}
    </section>
  );
}

export function matchRows(s: AppState): (string | number)[][] {
  const pm = playerMap(s);
  return s.matches
    .filter((m) => m.status !== 'bye')
    .sort((a, b) => a.number - b.number)
    .map((m) => {
      const A = entryById(s, m.a);
      const B = entryById(s, m.b);
      const w = m.winner ? entryName(s, entryById(s, m[m.winner]), pm) : '';
      return [
        m.number,
        s.events.find((e) => e.id === m.eventId)?.name ?? '',
        matchRoundLabel(s, m),
        m.court ?? '',
        entryName(s, A, pm),
        entryAffiliation(s, A, pm),
        entryName(s, B, pm),
        entryAffiliation(s, B, pm),
        m.status === 'done' ? resultText(m, 'a') : '',
        w,
        fmtTime(m.startedAt),
        fmtTime(m.endedAt),
      ];
    });
}

function MatchList() {
  const s = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [eventId, setEventId] = useState('');
  const header = ['No', '種目', '回戦', 'コート', '対戦者A', '所属A', '対戦者B', '所属B', 'スコア', '勝者', '開始', '終了'];
  const rows = matchRows(s).filter((r) => !eventId || r[1] === s.events.find((e) => e.id === eventId)?.name);
  const em = s.matches.find((m) => m.id === editing);
  const statusLabel = { waiting: '待機', called: 'コール済', playing: '試合中', done: '終了', bye: '' };
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <EventSelect events={s.events} value={eventId} onChange={setEventId} all />
        <span className="spacer" />
        <button className="secondary" onClick={() => download('対戦結果明細.csv', toCSV([header, ...rows]))}>
          CSV出力（対戦結果明細）
        </button>
      </div>
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              {header.slice(0, 10).map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {s.matches
              .filter((m) => m.status !== 'bye' && (!eventId || m.eventId === eventId))
              .sort((a, b) => a.number - b.number)
              .map((m) => {
                const r = matchRows({ ...s, matches: [m] })[0];
                return (
                  <tr key={m.id} onClick={() => m.a && m.b && setEditing(m.id)} style={{ cursor: m.a && m.b ? 'pointer' : undefined }}>
                    {r.slice(0, 10).map((c, i) => (
                      <td key={i} className={i === 5 || i === 7 ? 'muted small' : ''}>
                        {c}
                      </td>
                    ))}
                    <td>
                      <span className={`tag ${m.status === 'done' ? 'ok' : m.status === 'playing' ? 'info' : m.status === 'called' ? 'warn' : ''}`}>{statusLabel[m.status]}</span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {em && <ScoreDialog key={em.id} state={s} match={em} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Analysis() {
  const s = useAppState();
  const timed = s.matches.filter((m) => m.status === 'done' && m.startedAt && m.endedAt && m.endedAt > m.startedAt && m.finish !== 'walkover');
  const dur = (m: Match) => (m.endedAt! - m.startedAt!) / 60000;
  const avg = (ms: Match[]) => (ms.length ? ms.reduce((t, m) => t + dur(m), 0) / ms.length : 0);
  const byEvent = s.events.map((ev) => {
    const ms = timed.filter((m) => m.eventId === ev.id);
    return { ev, n: ms.length, avg: avg(ms), max: ms.length ? Math.max(...ms.map(dur)) : 0, min: ms.length ? Math.min(...ms.map(dur)) : 0 };
  });
  const courts = Array.from({ length: s.tournament.courts }, (_, i) => i + 1).map((c) => {
    const ms = timed.filter((m) => m.court === c);
    return { c, n: ms.length, total: ms.reduce((t, m) => t + dur(m), 0) };
  });
  const longest = [...timed].sort((a, b) => dur(b) - dur(a)).slice(0, 10);
  const pm = playerMap(s);
  return (
    <section className="panel">
      <p className="muted small">コートで「開始」を押してから結果を確定するまでの時間で集計します（不戦勝は除く）。対象 {timed.length} 試合。</p>
      <h4>種目別</h4>
      <table className="list">
        <thead>
          <tr>
            <th>種目</th>
            <th className="num">試合数</th>
            <th className="num">平均（分）</th>
            <th className="num">最短</th>
            <th className="num">最長</th>
            <th className="num">設定の目安</th>
          </tr>
        </thead>
        <tbody>
          {byEvent.map(({ ev, n, avg: a, max, min }) => (
            <tr key={ev.id}>
              <td>{ev.name}</td>
              <td className="num">{n}</td>
              <td className="num">{n ? a.toFixed(1) : '-'}</td>
              <td className="num">{n ? min.toFixed(0) : '-'}</td>
              <td className="num">{n ? max.toFixed(0) : '-'}</td>
              <td className="num">{ev.estMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>コート別</h4>
      <table className="list">
        <thead>
          <tr>
            <th>コート</th>
            <th className="num">試合数</th>
            <th className="num">合計時間（分）</th>
          </tr>
        </thead>
        <tbody>
          {courts.map((c) => (
            <tr key={c.c}>
              <td>第{c.c}コート</td>
              <td className="num">{c.n}</td>
              <td className="num">{c.total.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>長かった試合</h4>
      <table className="list">
        <tbody>
          {longest.map((m) => (
            <tr key={m.id}>
              <td className="num">No.{m.number}</td>
              <td>{s.events.find((e) => e.id === m.eventId)?.name}</td>
              <td>
                {entryName(s, entryById(s, m.a), pm)} 対 {entryName(s, entryById(s, m.b), pm)}
              </td>
              <td className="num">{dur(m).toFixed(0)}分</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
