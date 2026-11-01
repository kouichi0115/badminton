import { Fragment, useState, type ReactNode } from 'react';
import { useAppState, update } from '../store';
import { Empty, EventSelect, Field, NumInput } from '../components/common';
import { Bracket, LeagueTables } from '../components/Bracket';
import { placements } from '../logic/results';
import { entryAffiliation, entryById, entryKana, entryName, matchRoundLabel, playerMap } from '../logic/names';
import { simulate } from '../logic/scheduler';
import { fmtMinutes, parseHHMM } from '../logic/util';
import { callText } from '../logic/call';
import { fillTemplate } from '../logic/speech';
import type { AppState, Match } from '../types';
import { RpScoreSheet, type RpSheetData, type RpSide } from '../print/RpScoreSheet';

type Doc = 'bracket' | 'progress' | 'timetable' | 'scoresheet' | 'order' | 'results' | 'roster' | 'fee' | 'namecard' | 'certificate' | 'calls';

const DOCS: { id: Doc; label: string }[] = [
  { id: 'bracket', label: '対戦表（トーナメント・リーグ）' },
  { id: 'progress', label: '進行表' },
  { id: 'timetable', label: 'タイムテーブル（コート別）' },
  { id: 'scoresheet', label: '審判用紙（スコアシート）' },
  { id: 'order', label: '団体戦オーダー用紙' },
  { id: 'calls', label: '放送原稿' },
  { id: 'results', label: '大会結果報告' },
  { id: 'roster', label: '参加者名簿' },
  { id: 'fee', label: '参加費一覧' },
  { id: 'namecard', label: '看板（名前札）' },
  { id: 'certificate', label: '賞状' },
];

/** 1〜99 を漢数字に */
function kanjiNum(n: number): string {
  const d = '〇一二三四五六七八九';
  if (n < 10) return d[n];
  const t = Math.floor(n / 10);
  return `${t > 1 ? d[t] : ''}十${n % 10 ? d[n % 10] : ''}`;
}

export function warekiDate(iso: string, kanji = false): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear() - 2018;
  const f = (n: number) => (kanji ? kanjiNum(n) : String(n));
  return `令和${y === 1 ? '元' : f(y)}年${f(d.getMonth() + 1)}月${f(d.getDate())}日`;
}

export default function PrintPage() {
  const s = useAppState();
  const [doc, setDoc] = useState<Doc>('bracket');
  const [eventId, setEventId] = useState('');
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(0);
  const [onlyReady, setOnlyReady] = useState(true);
  const [depth, setDepth] = useState(3);
  const [nc, setNc] = useState({ vertical: false, kana: true, aff: true });
  const [ssFormat, setSsFormat] = useState<'rp' | 'simple'>('rp');

  const landscape = doc === 'namecard' || (doc === 'certificate' && s.tournament.certificate.orientation === 'horizontal') || doc === 'timetable' || (doc === 'scoresheet' && ssFormat === 'rp');
  const usesEvent = ['bracket', 'roster', 'namecard', 'certificate', 'results', 'progress', 'scoresheet', 'calls', 'order'].includes(doc);
  const usesRange = ['scoresheet', 'calls', 'progress', 'order'].includes(doc);
  const events = eventId ? s.events.filter((e) => e.id === eventId) : s.events;
  const rangeFilter = (m: Match) => m.status !== 'bye' && m.number >= from && (!to || m.number <= to) && (!eventId || m.eventId === eventId);

  return (
    <>
      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
      <section className="panel no-print print-controls">
        <div className="row">
          <select value={doc} onChange={(e) => setDoc(e.target.value as Doc)} aria-label="帳票">
            {DOCS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          {usesEvent && <EventSelect events={s.events} value={eventId} onChange={setEventId} all />}
          {usesRange && (
            <>
              <span className="small">試合番号</span>
              <NumInput value={from} min={1} style={{ width: 70 }} onChange={setFrom} />〜
              <NumInput value={to} style={{ width: 70 }} onChange={setTo} />
              <span className="muted small">（0=最後まで）</span>
            </>
          )}
          {doc === 'scoresheet' && (
            <select value={ssFormat} onChange={(e) => setSsFormat(e.target.value as 'rp' | 'simple')} aria-label="審判用紙の書式">
              <option value="rp">標準（ラリーポイント・A4横 1枚1試合）</option>
              <option value="simple">簡易（A4縦 2試合）</option>
            </select>
          )}
          {(doc === 'scoresheet' || doc === 'calls' || doc === 'order') && (
            <label className="row small" style={{ gap: 4 }}>
              <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} />
              対戦者が決まった未終了の試合のみ
            </label>
          )}
          {doc === 'certificate' && (
            <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label="対象">
              <option value={1}>優勝のみ</option>
              <option value={2}>準優勝まで</option>
              <option value={4}>3位まで</option>
              <option value={8}>ベスト8まで</option>
            </select>
          )}
          {doc === 'namecard' && (
            <>
              <label className="row small" style={{ gap: 4 }}>
                <input type="checkbox" checked={nc.vertical} onChange={(e) => setNc({ ...nc, vertical: e.target.checked })} />
                縦書き
              </label>
              <label className="row small" style={{ gap: 4 }}>
                <input type="checkbox" checked={nc.kana} onChange={(e) => setNc({ ...nc, kana: e.target.checked })} />
                ふりがな
              </label>
              <label className="row small" style={{ gap: 4 }}>
                <input type="checkbox" checked={nc.aff} onChange={(e) => setNc({ ...nc, aff: e.target.checked })} />
                所属
              </label>
            </>
          )}
          <span className="spacer" />
          <button onClick={() => window.print()}>🖨️ 印刷</button>
        </div>
        {doc === 'certificate' && <CertificateSettings />}
        <p className="muted small" style={{ marginBottom: 0 }}>
          印刷画面で「PDFに保存」を選ぶとPDFにできます。用紙は A4{landscape ? '横' : '縦'}、余白なし・倍率100%（背景のグラフィックを有効）をおすすめします。
        </p>
      </section>

      <div className="print-scroll">
        {doc === 'bracket' && events.map((ev) => <BracketSheet key={ev.id} s={s} eventId={ev.id} />)}
        {doc === 'progress' && <ProgressSheet s={s} filter={rangeFilter} />}
        {doc === 'timetable' && <TimetableSheet s={s} />}
        {doc === 'scoresheet' &&
          (ssFormat === 'rp' ? (
            <RpSheets s={s} matches={s.matches.filter((m) => rangeFilter(m) && (!onlyReady || (m.a && m.b && m.status !== 'done')))} />
          ) : (
            <ScoreSheets s={s} matches={s.matches.filter((m) => rangeFilter(m) && (!onlyReady || (m.a && m.b && m.status !== 'done')))} />
          ))}
        {doc === 'order' && <OrderSheets s={s} matches={s.matches.filter((m) => rangeFilter(m) && (!onlyReady || (m.a && m.b && m.status !== 'done')))} />}
        {doc === 'calls' && <CallsSheet s={s} matches={s.matches.filter((m) => rangeFilter(m) && (!onlyReady || (m.a && m.b && m.status !== 'done')))} />}
        {doc === 'results' && <ResultsSheet s={s} eventIds={events.map((e) => e.id)} />}
        {doc === 'roster' && events.map((ev) => <RosterSheet key={ev.id} s={s} eventId={ev.id} />)}
        {doc === 'fee' && <FeeSheet s={s} />}
        {doc === 'namecard' && <NameCards s={s} eventIds={events.map((e) => e.id)} opt={nc} />}
        {doc === 'certificate' && <Certificates s={s} eventIds={events.map((e) => e.id)} depth={depth} />}
      </div>
    </>
  );
}

function Sheet({ children, landscape }: { children: ReactNode; landscape?: boolean }) {
  return <div className={`sheet ${landscape ? 'a4l' : 'a4p'}`}>{children}</div>;
}

function Title({ s, sub }: { s: AppState; sub: string }) {
  return (
    <>
      <h1>{s.tournament.name || '大会'}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', marginBottom: '3mm' }}>
        <b style={{ fontSize: '13pt' }}>{sub}</b>
        <span>
          {s.tournament.date} {s.tournament.venue}
        </span>
      </div>
    </>
  );
}

function BracketSheet({ s, eventId }: { s: AppState; eventId: string }) {
  const ev = s.events.find((e) => e.id === eventId)!;
  const main = s.matches.filter((m) => m.eventId === eventId && m.stage === 'main');
  const hasLeague = s.matches.some((m) => m.eventId === eventId && m.stage === 'league');
  if (!main.length && !hasLeague) return null;
  const size = main.length ? 2 ** Math.max(...main.map((m) => m.round)) : 0;
  return (
    <Sheet>
      <Title s={s} sub={ev.name} />
      {hasLeague && <LeagueTables state={s} eventId={eventId} />}
      {main.length > 0 && (
        <div className="print-bracket">
          <Bracket state={s} eventId={eventId} print rowHeight={Math.max(12, Math.min(28, Math.floor((hasLeague ? 560 : 960) / size)))} />
        </div>
      )}
    </Sheet>
  );
}

function ProgressSheet({ s, filter }: { s: AppState; filter: (m: Match) => boolean }) {
  const plan = new Map(simulate(s, parseHHMM(s.tournament.startTime)).map((p) => [p.matchId, p]));
  const pm = playerMap(s);
  const list = s.matches.filter(filter).sort((a, b) => a.number - b.number);
  const pages: Match[][] = [];
  for (let i = 0; i < list.length; i += 32) pages.push(list.slice(i, i + 32));
  if (!pages.length) return <Empty>対象の試合がありません。</Empty>;
  return (
    <>
      {pages.map((pg, i) => (
        <Sheet key={i}>
          <Title s={s} sub={`進行表 ${pages.length > 1 ? `(${i + 1}/${pages.length})` : ''}`} />
          <table className="pt">
            <thead>
              <tr>
                <th>No</th>
                <th>予定</th>
                <th>種目・回戦</th>
                <th>対戦者</th>
                <th>対戦者</th>
                <th style={{ width: '14mm' }}>コート</th>
                <th style={{ width: '28mm' }}>結果</th>
              </tr>
            </thead>
            <tbody>
              {pg.map((m) => {
                const A = entryById(s, m.a);
                const B = entryById(s, m.b);
                const p = plan.get(m.id);
                return (
                  <tr key={m.id}>
                    <td style={{ textAlign: 'center' }}>{m.number}</td>
                    <td style={{ textAlign: 'center' }}>{p ? fmtMinutes(p.start) : ''}</td>
                    <td>
                      {s.events.find((e) => e.id === m.eventId)?.name}
                      <br />
                      {matchRoundLabel(s, m)}
                    </td>
                    <td>
                      {entryName(s, A, pm)}
                      <br />
                      <small>{entryAffiliation(s, A, pm)}</small>
                    </td>
                    <td>
                      {entryName(s, B, pm)}
                      <br />
                      <small>{entryAffiliation(s, B, pm)}</small>
                    </td>
                    <td style={{ textAlign: 'center' }}>{m.court ?? ''}</td>
                    <td style={{ fontSize: '8pt' }}>{m.status === 'done' ? (m.winner === 'a' ? '◀ ' : '▶ ') + m.games.map((g) => g.join('-')).join(' ') : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Sheet>
      ))}
    </>
  );
}

function TimetableSheet({ s }: { s: AppState }) {
  const plan = simulate(s, parseHHMM(s.tournament.startTime));
  const byId = new Map(s.matches.map((m) => [m.id, m]));
  const pm = playerMap(s);
  const courts = Array.from({ length: s.tournament.courts }, (_, i) => plan.filter((p) => p.court === i + 1));
  const rows = Math.max(0, ...courts.map((c) => c.length));
  const perPage = 14;
  const pages = Math.max(1, Math.ceil(rows / perPage));
  const end = plan.length ? Math.max(...plan.map((p) => p.end)) : 0;
  return (
    <>
      {Array.from({ length: pages }, (_, pg) => (
        <Sheet key={pg} landscape>
          <Title s={s} sub={`タイムテーブル（見込み） 開始 ${s.tournament.startTime} ／ 終了見込み ${fmtMinutes(end)}`} />
          <table className="pt" style={{ fontSize: '7.5pt' }}>
            <thead>
              <tr>
                <th style={{ width: '6mm' }}></th>
                {courts.map((_, i) => (
                  <th key={i}>第{i + 1}コート</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(perPage, rows - pg * perPage) }, (_, r) => {
                const k = pg * perPage + r;
                return (
                  <tr key={k}>
                    <td>{k + 1}</td>
                    {courts.map((c, i) => {
                      const p = c[k];
                      const m = p && byId.get(p.matchId);
                      return (
                        <td key={i}>
                          {m && (
                            <>
                              <b>
                                {fmtMinutes(p.start)} No.{m.number}
                              </b>
                              <br />
                              {s.events.find((e) => e.id === m.eventId)?.name.slice(0, 8)} {matchRoundLabel(s, m)}
                              <br />
                              {entryName(s, entryById(s, m.a), pm) || '―'} / {entryName(s, entryById(s, m.b), pm) || '―'}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: '8pt' }}>※ 各種目の目安時間と休憩時間から計算した見込みです。実際の進行とは異なります。</p>
        </Sheet>
      ))}
    </>
  );
}

/** 開催日を「2026年10月31日」の形に */
function jpDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 標準様式（ラリーポイント用・A4横）の審判用紙。団体戦は各試合ごとに1枚 */
function RpSheets({ s, matches }: { s: AppState; matches: Match[] }) {
  const list = [...matches].sort((a, b) => a.number - b.number);
  if (!list.length) return <Empty>対象の試合がありません。</Empty>;
  const pm = playerMap(s);
  const plan = new Map(simulate(s, parseHHMM(s.tournament.startTime)).map((p) => [p.matchId, p]));
  const sheets: { key: string; d: RpSheetData }[] = [];
  for (const m of list) {
    const ev = s.events.find((e) => e.id === m.eventId)!;
    const A = entryById(s, m.a);
    const B = entryById(s, m.b);
    const p = plan.get(m.id);
    const base = {
      tournament: s.tournament.name,
      matchNo: m.number ? String(m.number) : '',
      court: m.court ? String(m.court) : '',
      date: jpDate(s.tournament.date),
      plannedStart: p ? fmtMinutes(p.start) : '',
      eventLabel: `${ev.name} ${matchRoundLabel(s, m)}`,
      organizer: s.tournament.organizer,
    };
    if (ev.type === 'team') {
      const team = (e: typeof A, ids: string[]): RpSide => ({
        names: ids.map((id) => pm.get(id)?.name ?? ''),
        kanas: ids.map((id) => pm.get(id)?.kana ?? ''),
        affiliation: entryName(s, e, pm),
      });
      ev.rubbers.forEach((r, i) => {
        const ord = m.rubbers[i];
        sheets.push({ key: `${m.id}-${i}`, d: { ...base, teamOrder: r.label, doubles: r.type === 'doubles', a: team(A, ord?.a ?? []), b: team(B, ord?.b ?? []) } });
      });
    } else {
      const side = (e: typeof A): RpSide => ({
        names: (e?.playerIds ?? []).map((id) => pm.get(id)?.name ?? ''),
        kanas: (e?.playerIds ?? []).map((id) => pm.get(id)?.kana ?? ''),
        affiliation: entryAffiliation(s, e, pm),
      });
      sheets.push({ key: m.id, d: { ...base, teamOrder: '', doubles: ev.type === 'doubles', a: side(A), b: side(B) } });
    }
  }
  return (
    <>
      {sheets.map((x) => (
        <div key={x.key} className="sheet a4l bare">
          <RpScoreSheet d={x.d} />
        </div>
      ))}
    </>
  );
}

function ScoreSheets({ s, matches }: { s: AppState; matches: Match[] }) {
  const list = [...matches].sort((a, b) => a.number - b.number);
  if (!list.length) return <Empty>対象の試合がありません。</Empty>;
  const pages: Match[][] = [];
  for (let i = 0; i < list.length; i += 2) pages.push(list.slice(i, i + 2));
  const pm = playerMap(s);
  return (
    <>
      {pages.map((pg, i) => (
        <Sheet key={i}>
          {pg.map((m) => {
            const ev = s.events.find((e) => e.id === m.eventId)!;
            const A = entryById(s, m.a);
            const B = entryById(s, m.b);
            const cells = ev.rules.cap;
            const nGames = ev.rules.gamesToWin * 2 - 1;
            if (ev.type === 'team') return <TeamSheet key={m.id} s={s} m={m} />;
            return (
              <div key={m.id} className="scoresheet">
                <div className="ss-head">
                  <span>{s.tournament.name}</span>
                  <span>審判用紙</span>
                </div>
                <div className="ss-head" style={{ fontSize: '12pt' }}>
                  <span>
                    試合番号 No.{m.number}　{ev.name}　{matchRoundLabel(s, m)}
                  </span>
                  <span>第 {m.court ?? '　　'} コート</span>
                </div>
                <table className="names">
                  <tbody>
                    <tr>
                      <td style={{ width: '50%' }}>
                        {entryName(s, A, pm)}
                        <div style={{ fontSize: '9pt', fontWeight: 400 }}>{entryAffiliation(s, A, pm)}</div>
                      </td>
                      <td>
                        {entryName(s, B, pm)}
                        <div style={{ fontSize: '9pt', fontWeight: 400 }}>{entryAffiliation(s, B, pm)}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table className="grid">
                  <tbody>
                    {Array.from({ length: nGames }, (_, g) => (
                      <Fragment key={g}>
                        <tr>
                          <td rowSpan={2} style={{ width: '10mm', fontSize: '8pt' }}>
                            第{g + 1}G
                          </td>
                          <td style={{ width: '6mm' }}>A</td>
                          {Array.from({ length: cells }, (_, k) => (
                            <td key={k} />
                          ))}
                          <td rowSpan={1} style={{ width: '9mm' }} />
                        </tr>
                        <tr>
                          <td>B</td>
                          {Array.from({ length: cells }, (_, k) => (
                            <td key={k} />
                          ))}
                          <td />
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <table>
                  <tbody>
                    <tr>
                      <th style={{ width: '20%' }}>勝者</th>
                      <td style={{ width: '40%' }} />
                      <th style={{ width: '15%' }}>スコア</th>
                      <td />
                    </tr>
                    <tr>
                      <th>開始</th>
                      <td>　　：</td>
                      <th>終了</th>
                      <td>　　：</td>
                    </tr>
                    <tr>
                      <th>主審</th>
                      <td />
                      <th>勝者サイン</th>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </Sheet>
      ))}
    </>
  );
}

function TeamSheet({ s, m }: { s: AppState; m: Match }) {
  const ev = s.events.find((e) => e.id === m.eventId)!;
  const pm = playerMap(s);
  const A = entryById(s, m.a);
  const B = entryById(s, m.b);
  return (
    <div className="scoresheet">
      <div className="ss-head">
        <span>{s.tournament.name}</span>
        <span>団体戦 対戦明細</span>
      </div>
      <div className="ss-head" style={{ fontSize: '12pt' }}>
        <span>
          No.{m.number}　{ev.name}　{matchRoundLabel(s, m)}
        </span>
        <span>第 {m.court ?? '　　'} コート</span>
      </div>
      <table className="names">
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>{entryName(s, A, pm)}</td>
            <td>{entryName(s, B, pm)}</td>
          </tr>
        </tbody>
      </table>
      <table>
        <thead>
          <tr>
            <th style={{ width: '18%' }}>種別</th>
            <th>{entryName(s, A, pm)} 選手</th>
            <th style={{ width: '24%' }}>スコア</th>
            <th>{entryName(s, B, pm)} 選手</th>
            <th style={{ width: '8%' }}>勝</th>
          </tr>
        </thead>
        <tbody>
          {ev.rubbers.map((r, i) => (
            <tr key={i} style={{ height: '13mm' }}>
              <td>{r.label}</td>
              <td>{(m.rubbers[i]?.a ?? []).map((id) => pm.get(id)?.name).join('・')}</td>
              <td />
              <td>{(m.rubbers[i]?.b ?? []).map((id) => pm.get(id)?.name).join('・')}</td>
              <td />
            </tr>
          ))}
          <tr style={{ height: '10mm' }}>
            <th>結果</th>
            <td colSpan={4} style={{ textAlign: 'left' }}>
              勝者：　　　　　　　　　　　（　　勝　　敗）
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CallsSheet({ s, matches }: { s: AppState; matches: Match[] }) {
  const list = [...matches].sort((a, b) => a.number - b.number);
  if (!list.length) return <Empty>対象の試合がありません。</Empty>;
  const pages: Match[][] = [];
  for (let i = 0; i < list.length; i += 8) pages.push(list.slice(i, i + 8));
  return (
    <>
      {pages.map((pg, i) => (
        <Sheet key={i}>
          <Title s={s} sub="放送原稿" />
          {pg.map((m) => (
            <div key={m.id} style={{ border: '1px solid #000', padding: '3mm', marginBottom: '3mm', fontSize: '11pt', lineHeight: 1.7 }}>
              <b>No.{m.number}</b>　{callText(s, { ...m, court: m.court ?? ('　' as unknown as number) })}
              <div style={{ fontSize: '9pt', color: '#444' }}>よみ：{callText(s, { ...m, court: m.court ?? ('　' as unknown as number) }, true)}</div>
            </div>
          ))}
        </Sheet>
      ))}
    </>
  );
}

function ResultsSheet({ s, eventIds }: { s: AppState; eventIds: string[] }) {
  const pm = playerMap(s);
  return (
    <Sheet>
      <Title s={s} sub="大会結果報告" />
      {eventIds.map((id) => {
        const ev = s.events.find((e) => e.id === id)!;
        const pl = placements(s, id, 8);
        return (
          <div key={id} style={{ breakInside: 'avoid' }}>
            <h2>
              {ev.name}（{s.entries.filter((e) => e.eventId === id).length}エントリー）
            </h2>
            {pl.length === 0 ? (
              <p style={{ fontSize: '9pt' }}>未確定</p>
            ) : (
              <table className="pt">
                <tbody>
                  {pl.map((p, i) => (
                    <tr key={i}>
                      <th style={{ width: '22mm' }}>{p.label}</th>
                      <td>{entryName(s, entryById(s, p.entryId), pm)}</td>
                      <td>{entryAffiliation(s, entryById(s, p.entryId), pm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}

function RosterSheet({ s, eventId }: { s: AppState; eventId: string }) {
  const ev = s.events.find((e) => e.id === eventId)!;
  const pm = playerMap(s);
  const entries = s.entries.filter((e) => e.eventId === eventId);
  if (!entries.length) return null;
  return (
    <Sheet>
      <Title s={s} sub={`参加者名簿　${ev.name}（${entries.length}）`} />
      <table className="pt">
        <thead>
          <tr>
            <th>No</th>
            <th>{ev.type === 'team' ? 'チーム' : '氏名'}</th>
            <th>{ev.type === 'team' ? 'メンバー' : 'ふりがな'}</th>
            <th>所属</th>
            <th>シード</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{entryName(s, e, pm)}</td>
              <td style={{ fontSize: '8pt' }}>{ev.type === 'team' ? e.playerIds.map((p) => pm.get(p)?.name).join('、') : entryKana(s, e, pm)}</td>
              <td>{entryAffiliation(s, e, pm)}</td>
              <td style={{ textAlign: 'center' }}>{e.seed || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

function FeeSheet({ s }: { s: AppState }) {
  const pm = playerMap(s);
  const affs = new Map<string, Map<string, number>>();
  for (const e of s.entries) {
    const a = entryAffiliation(s, e, pm).split('・')[0] || '（所属なし）';
    if (!affs.has(a)) affs.set(a, new Map());
    affs.get(a)!.set(e.eventId, (affs.get(a)!.get(e.eventId) ?? 0) + 1);
  }
  const rows = [...affs.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'));
  const fee = (m: Map<string, number>) => s.events.reduce((t, ev) => t + (m.get(ev.id) ?? 0) * ev.fee, 0);
  const paid = new Set(s.tournament.paidAffiliations);
  return (
    <Sheet>
      <Title s={s} sub="参加数・参加費一覧" />
      <table className="pt">
        <thead>
          <tr>
            <th>所属</th>
            {s.events.map((e) => (
              <th key={e.id}>{e.name}</th>
            ))}
            <th>参加費</th>
            <th>受領</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, m]) => (
            <tr key={a}>
              <td>{a}</td>
              {s.events.map((e) => (
                <td key={e.id} style={{ textAlign: 'right' }}>
                  {m.get(e.id) ?? ''}
                </td>
              ))}
              <td style={{ textAlign: 'right' }}>{fee(m).toLocaleString()}</td>
              <td style={{ textAlign: 'center' }}>{paid.has(a) ? '済' : ''}</td>
            </tr>
          ))}
          <tr>
            <th>合計</th>
            {s.events.map((e) => (
              <th key={e.id} style={{ textAlign: 'right' }}>
                {s.entries.filter((x) => x.eventId === e.id).length}
              </th>
            ))}
            <th style={{ textAlign: 'right' }}>{rows.reduce((t, [, m]) => t + fee(m), 0).toLocaleString()}</th>
            <th></th>
          </tr>
        </tbody>
      </table>
    </Sheet>
  );
}

function NameCards({ s, eventIds, opt }: { s: AppState; eventIds: string[]; opt: { vertical: boolean; kana: boolean; aff: boolean } }) {
  const pm = playerMap(s);
  const entries = s.entries.filter((e) => eventIds.includes(e.eventId));
  if (!entries.length) return <Empty>エントリーがありません。</Empty>;
  return (
    <>
      {entries.map((e) => {
        const names = e.teamName ? [e.teamName] : e.playerIds.map((id) => pm.get(id)?.name ?? '');
        const kanas = e.teamName ? [] : e.playerIds.map((id) => pm.get(id)?.kana ?? '');
        const big = names.length > 1 ? (opt.vertical ? 80 : 72) : opt.vertical ? 120 : 110;
        return (
          <Sheet key={e.id} landscape>
            <div className={`namecard ${opt.vertical ? 'vertical' : ''}`} style={{ height: '186mm', gap: '6mm' }}>
              {names.map((n, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {opt.kana && kanas[i] && <div className="nc-kana">{kanas[i]}</div>}
                  <div style={{ fontSize: `${big}pt`, fontWeight: 800, lineHeight: 1.1, letterSpacing: '0.05em' }}>{n}</div>
                </div>
              ))}
              {opt.aff && <div className="nc-aff">{entryAffiliation(s, e, pm)}</div>}
            </div>
          </Sheet>
        );
      })}
    </>
  );
}

function CertificateSettings() {
  const s = useAppState();
  const c = s.tournament.certificate;
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => update((d) => void (d.tournament.certificate[k] = v as never));
  return (
    <details style={{ margin: '8px 0' }}>
      <summary className="small">賞状の文面・書式</summary>
      <div className="grid3" style={{ marginTop: 8 }}>
        <Field label="向き">
          <select value={c.orientation} onChange={(e) => set('orientation', e.target.value as 'vertical' | 'horizontal')}>
            <option value="vertical">縦書き（A4縦）</option>
            <option value="horizontal">横書き（A4横）</option>
          </select>
        </Field>
        <Field label="表題">
          <input value={c.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="日付" hint="空欄なら開催日を和暦で表示">
          <input value={c.dateText} onChange={(e) => set('dateText', e.target.value)} placeholder={warekiDate(s.tournament.date)} />
        </Field>
        <Field label="授与者">
          <input value={c.organizer} onChange={(e) => set('organizer', e.target.value)} placeholder="例：○○市バドミントン協会 会長 ○○○○" />
        </Field>
        <Field label="所属を表示">
          <select value={c.showAffiliation ? '1' : ''} onChange={(e) => set('showAffiliation', !!e.target.value)}>
            <option value="1">する</option>
            <option value="">しない</option>
          </select>
        </Field>
      </div>
      <Field label="本文" hint="差し込み：{大会名} {種目} {順位}">
        <textarea rows={2} value={c.body} onChange={(e) => set('body', e.target.value)} />
      </Field>
    </details>
  );
}

function Certificates({ s, eventIds, depth }: { s: AppState; eventIds: string[]; depth: number }) {
  const c = s.tournament.certificate;
  const pm = playerMap(s);
  const list = eventIds.flatMap((id) => {
    const ev = s.events.find((e) => e.id === id)!;
    return placements(s, id, 8)
      .filter((p) => p.place <= depth)
      .map((p) => ({ ev, p }));
  });
  if (!list.length) return <Empty>入賞者が決まっていません。</Empty>;
  const vertical = c.orientation === 'vertical';
  return (
    <>
      {list.map(({ ev, p }, i) => {
        const e = entryById(s, p.entryId);
        const names = e?.teamName ? [e.teamName] : (e?.playerIds ?? []).map((id) => pm.get(id)?.name ?? '');
        const body = fillTemplate(c.body, { 大会名: s.tournament.name, 種目: ev.name, 順位: p.label });
        return (
          <Sheet key={i} landscape={!vertical}>
            <div className={`cert ${vertical ? 'vertical' : 'horizontal'}`} style={vertical ? { height: '273mm', display: 'block' } : { height: '186mm' }}>
              <div className="c-title">{c.title}</div>
              <div className="c-place">
                {ev.name}　{p.label}
              </div>
              <div>
                {names.map((n, k) => (
                  <div key={k} className="c-name">
                    {n}
                    {vertical ? '　殿' : ' 殿'}
                  </div>
                ))}
                {c.showAffiliation && <div className="c-aff">{entryAffiliation(s, e, pm)}</div>}
              </div>
              <div className="c-body">{body}</div>
              <div className="c-date">{c.dateText || warekiDate(s.tournament.date, vertical)}</div>
              <div className="c-org">{c.organizer || s.tournament.organizer}</div>
            </div>
          </Sheet>
        );
      })}
    </>
  );
}

/** 団体戦オーダー用紙：A4縦に1試合分（上がチームA、下がチームB） */
function OrderSheets({ s, matches }: { s: AppState; matches: Match[] }) {
  const isTeam = (m: Match) => s.events.find((e) => e.id === m.eventId)?.type === 'team';
  const list = matches.filter(isTeam).sort((a, b) => a.number - b.number);
  if (!list.length) return <Empty>対象の団体戦の試合がありません。</Empty>;
  return (
    <>
      {list.map((m) => (
        <Sheet key={m.id}>
          <OrderForm s={s} m={m} side="a" />
          <div className="cut-line">✂ ･････････････････････････ 切り取り ･････････････････････････</div>
          <OrderForm s={s} m={m} side="b" />
        </Sheet>
      ))}
    </>
  );
}

function OrderForm({ s, m, side }: { s: AppState; m: Match; side: 'a' | 'b' }) {
  const ev = s.events.find((e) => e.id === m.eventId)!;
  const pm = playerMap(s);
  const me = entryById(s, m[side]);
  const opp = entryById(s, m[side === 'a' ? 'b' : 'a']);
  const members = me?.playerIds ?? [];
  const numOf = (id: string) => members.indexOf(id) + 1;
  return (
    <div className="order-form">
      <div className="of-head">
        <span>{s.tournament.name}</span>
        <span>
          試合番号 No.{m.number}　第 {m.court ?? '　　'} コート
        </span>
      </div>
      <h1>オーダー用紙</h1>
      <table className="pt of-info">
        <tbody>
          <tr>
            <th style={{ width: '18%' }}>種目</th>
            <td colSpan={3}>
              {ev.name}　{matchRoundLabel(s, m)}
            </td>
          </tr>
          <tr>
            <th>チーム名</th>
            <td style={{ width: '37%', fontSize: '13pt', fontWeight: 700 }}>{entryName(s, me, pm)}</td>
            <th style={{ width: '13%' }}>対戦相手</th>
            <td>{entryName(s, opp, pm)}</td>
          </tr>
        </tbody>
      </table>
      <div className="of-body">
        <table className="pt of-order">
          <thead>
            <tr>
              <th style={{ width: '24%' }}>試合</th>
              <th style={{ width: '12%' }}>番号</th>
              <th>選手名</th>
            </tr>
          </thead>
          <tbody>
            {ev.rubbers.flatMap((r, i) => {
              const ids = m.rubbers[i]?.[side] ?? [];
              const n = r.type === 'doubles' ? 2 : 1;
              return Array.from({ length: n }, (_, k) => (
                <tr key={`${i}-${k}`}>
                  {k === 0 && <th rowSpan={n}>{r.label}</th>}
                  <td style={{ textAlign: 'center' }}>{ids[k] ? numOf(ids[k]) : ''}</td>
                  <td style={{ fontSize: '12pt' }}>{ids[k] ? pm.get(ids[k])?.name : ''}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
        <div className="of-members">
          <div style={{ fontWeight: 700, marginBottom: '1mm' }}>登録選手</div>
          {members.map((id, i) => (
            <div key={id}>
              {i + 1}. {pm.get(id)?.name}
            </div>
          ))}
        </div>
      </div>
      <div className="of-sign">
        <span>提出時刻　　　時　　　分</span>
        <span>監督署名 ＿＿＿＿＿＿＿＿＿＿＿＿</span>
      </div>
    </div>
  );
}
