import { useState } from 'react';
import { useAppState, update } from '../store';
import { Empty, EventSelect } from '../components/common';
import { Bracket, LeagueTables } from '../components/Bracket';
import { clearDraw, currentSlots, eventLocked, generateFinals, generateKnockout, generateLeague, leagueGroups, rebuildLeague, renumberAll, setSlots } from '../actions';
import { sameKeyMeetings } from '../logic/draw';
import { entryAffiliation, entryById, entryName, groupLabel, playerMap } from '../logic/names';
import { roundName } from '../logic/bracket';

export default function DrawPage() {
  const s = useAppState();
  const [eventId, setEventId] = useState(s.events[0]?.id ?? '');
  const ev = s.events.find((e) => e.id === eventId) ?? s.events[0];
  const [sel, setSel] = useState<number | null>(null);
  if (!ev) return <Empty>種目がありません。<a href="#setup">大会設定</a>で追加してください。</Empty>;

  const entries = s.entries.filter((e) => e.eventId === ev.id);
  const ms = s.matches.filter((m) => m.eventId === ev.id);
  const hasMain = ms.some((m) => m.stage === 'main');
  const hasLeague = ms.some((m) => m.stage === 'league');
  const locked = eventLocked(ev.id);
  const mainLocked = ms.some((m) => m.stage !== 'league' && m.status !== 'waiting' && m.status !== 'bye');
  const leagueDone = hasLeague && ms.filter((m) => m.stage === 'league').every((m) => m.status === 'done');
  const pm = playerMap(s);

  const confirmRedo = () => !ms.length || confirm('今の組み合わせを作り直しますか？');
  const slots = hasMain ? currentSlots(s, ev.id) : [];
  const rounds = slots.length ? Math.log2(slots.length) : 0;
  const meetings = hasMain ? sameKeyMeetings(slots, (id) => entryAffiliation(s, entryById(s, id), pm)) : [];

  const clickSlot = (i: number) => {
    if (mainLocked) return;
    if (sel === null) return setSel(i);
    if (sel !== i) {
      const next = slots.slice();
      [next[sel], next[i]] = [next[i], next[sel]];
      if (next.some((x, k) => !x && !next[k ^ 1])) {
        alert('BYE 同士が当たる配置にはできません');
      } else setSlots(ev.id, next);
    }
    setSel(null);
  };

  const moveGroup = (entryId: string, g: number) => {
    update((d) => void (d.entries.find((e) => e.id === entryId)!.group = g));
    rebuildLeague(ev.id);
  };

  return (
    <>
      <section className="panel">
        <div className="row">
          <EventSelect events={s.events} value={ev.id} onChange={(v) => (setEventId(v), setSel(null))} />
          <span className="muted">
            {entries.length} エントリー ／ {{ tournament: 'トーナメント', league: 'リーグ戦', 'league-tournament': '予選リーグ＋決勝トーナメント' }[ev.format]}
          </span>
          <span className="spacer" />
          {ev.format === 'tournament' && (
            <button disabled={entries.length < 2 || locked} onClick={() => confirmRedo() && generateKnockout(ev.id)}>
              自動配置{hasMain ? '（やり直し）' : ''}
            </button>
          )}
          {ev.format !== 'tournament' && (
            <button disabled={entries.length < 2 || locked} onClick={() => confirmRedo() && generateLeague(ev.id)}>
              グループ分け・リーグ作成{hasLeague ? '（やり直し）' : ''}
            </button>
          )}
          {ev.format === 'league-tournament' && (
            <button disabled={!hasLeague || mainLocked} className={leagueDone ? '' : 'secondary'} onClick={() => (leagueDone || confirm('予選リーグがまだ終わっていません。現時点の順位で作りますか？')) && generateFinals(ev.id)}>
              決勝トーナメント作成
            </button>
          )}
          <button className="danger" disabled={!ms.length || locked} onClick={() => confirm('組み合わせを解除しますか？') && clearDraw(ev.id)}>
            解除
          </button>
        </div>
        {locked && <div className="notice warn">試合が始まっているため、組み合わせの作り直しはできません（元に戻すボタンで戻すことはできます）。</div>}
        {entries.length < 2 && <div className="notice">エントリーが2つ以上必要です。<a href="#entries">参加者</a>で登録してください。</div>}
      </section>

      {hasLeague && (
        <section className="panel">
          <h3>予選リーグ</h3>
          {!locked && (
            <details style={{ marginBottom: 10 }}>
              <summary className="small">グループを手で入れ替える</summary>
              <div className="grid3" style={{ marginTop: 8 }}>
                {leagueGroups(s, ev.id).map((ids, g) => (
                  <div key={g}>
                    <b>{groupLabel(g)}グループ</b>
                    {ids.map((id) => (
                      <div key={id} className="row small" style={{ gap: 4 }}>
                        <span style={{ flex: 1 }}>{entryName(s, entryById(s, id), pm)}</span>
                        <select value={g} onChange={(e) => moveGroup(id, Number(e.target.value))} aria-label="グループ">
                          {leagueGroups(s, ev.id).map((_, k) => (
                            <option key={k} value={k}>
                              {groupLabel(k)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
          <LeagueTables state={s} eventId={ev.id} />
        </section>
      )}

      {hasMain && (
        <>
          <section className="panel">
            <div className="row">
              <h3>{ev.format === 'league-tournament' ? '決勝トーナメント' : 'トーナメント'}の配置</h3>
              <span className="spacer" />
              <span className="muted small">{mainLocked ? '試合開始後は変更できません' : '2つの枠を順にクリックすると入れ替わります'}</span>
            </div>
            <div className="slots">
              {slots.map((id, i) => {
                const e = entryById(s, id);
                return (
                  <div key={i} className={`slot ${sel === i ? 'sel' : ''} ${!id ? 'bye' : ''} ${i % 2 ? 'pair-end' : ''}`} onClick={() => clickSlot(i)}>
                    <span className="pos">{i + 1}</span>
                    <span style={{ flex: 1 }}>{e ? entryName(s, e, pm) : 'BYE（不戦勝）'}</span>
                    {e?.seed ? <span className="tag info">第{e.seed}シード</span> : null}
                    <span className="muted small">{e ? entryAffiliation(s, e, pm) : ''}</span>
                  </div>
                );
              })}
            </div>
            <h4>同じ所属どうしの対戦（対戦回戦検査）</h4>
            {meetings.length === 0 ? (
              <p className="muted small">同じ所属どうしが当たる組み合わせはありません。</p>
            ) : (
              <ul className="small">
                {meetings.slice(0, 30).map((x, i) => (
                  <li key={i} style={{ color: x.round === 1 ? 'var(--danger)' : undefined }}>
                    {roundName(x.round, rounds)}で当たる可能性：{entryName(s, entryById(s, x.a), pm)} と {entryName(s, entryById(s, x.b), pm)}（{entryAffiliation(s, entryById(s, x.a), pm)}）
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h3>トーナメント表</h3>
            <Bracket state={s} eventId={ev.id} />
          </section>
        </>
      )}

      {s.matches.length > 0 && (
        <section className="panel">
          <div className="row">
            <span className="muted small">試合番号は「リーグ → トーナメント」「回戦ごとに種目順」で振られます。種目の順番は大会設定で変更できます。</span>
            <span className="spacer" />
            <button className="secondary small" disabled={s.matches.some((m) => m.status !== 'waiting' && m.status !== 'bye')} onClick={renumberAll}>
              全種目の試合番号を振り直す
            </button>
          </div>
        </section>
      )}
    </>
  );
}
