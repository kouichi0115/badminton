import { useMemo, useState } from 'react';
import type { AppState, FinishType, Match, Rubber, Side } from '../types';
import { Modal } from './common';
import { entryAffiliation, entryById, entryName, matchRoundLabel, playerMap } from '../logic/names';
import { gameWinner, matchWinner, parseScore, scoreText } from '../logic/score';
import { teamResult } from '../logic/team';
import { saveResult, setRubbers, undoResult } from '../actions';

export function ScoreDialog({ state, match, onClose }: { state: AppState; match: Match; onClose: () => void }) {
  const ev = state.events.find((e) => e.id === match.eventId)!;
  const pm = playerMap(state);
  const A = entryById(state, match.a);
  const B = entryById(state, match.b);
  const nameA = entryName(state, A, pm);
  const nameB = entryName(state, B, pm);
  const [finish, setFinish] = useState<FinishType>(match.finish);
  const [manualWinner, setManualWinner] = useState<Side | ''>(match.finish !== 'normal' ? match.winner ?? '' : '');
  const [error, setError] = useState('');
  const isTeam = ev.type === 'team';

  const rowsCount = ev.rules.gamesToWin * 2 - 1;
  const [rows, setRows] = useState<[string, string][]>(() =>
    Array.from({ length: rowsCount }, (_, i) => (match.games[i] ? [String(match.games[i][0]), String(match.games[i][1])] : ['', ''])),
  );
  const [rubbers, setRub] = useState<Rubber[]>(() => match.rubbers.map((r) => ({ ...r, a: [...r.a], b: [...r.b], games: r.games.map((g) => [...g] as [number, number]) })));

  const games = useMemo(
    () => rows.filter(([a, b]) => a !== '' || b !== '').map(([a, b]) => [Number(a) || 0, Number(b) || 0] as [number, number]),
    [rows],
  );

  const team = isTeam ? teamResult(rubbers, ev.rules) : null;
  const auto = isTeam ? { winner: team!.winner, error: team!.winner ? undefined : '団体の勝敗が決まっていません' } : matchWinner(games, ev.rules);
  const winner: Side | null = finish === 'normal' ? auto.winner : manualWinner || null;

  /** 各試合の勝者を記録しておく（順位計算などで使う） */
  const judged = () => rubbers.map((r) => ({ ...r, winner: r.finish === 'normal' ? matchWinner(r.games, ev.rules).winner ?? undefined : r.winner }));

  const save = () => {
    if (!winner) return setError(finish === 'normal' ? auto.error ?? '' : '勝者を選んでください');
    const err = saveResult(match.id, isTeam ? [] : games, winner, finish, isTeam ? judged() : undefined);
    if (err) return setError(err);
    onClose();
  };

  const quick = (text: string) => {
    const g = parseScore(text);
    if (!g.length) return;
    setRows(Array.from({ length: rowsCount }, (_, i) => (g[i] ? [String(g[i][0]), String(g[i][1])] : ['', ''])));
  };

  return (
    <Modal title={`No.${match.number}　${ev.name} ${matchRoundLabel(state, match)}${match.court ? `　第${match.court}コート` : ''}`} onClose={onClose} wide={isTeam}>
      <div className="score-row" style={{ marginBottom: 10 }}>
        <div className="side-name" style={{ textAlign: 'right' }}>
          {nameA}
          <div className="muted small">{entryAffiliation(state, A, pm)}</div>
        </div>
        <div />
        <div className="muted" style={{ textAlign: 'center' }}>
          対
        </div>
        <div />
        <div className="side-name">
          {nameB}
          <div className="muted small">{entryAffiliation(state, B, pm)}</div>
        </div>
      </div>

      {!isTeam && finish !== 'walkover' && (
        <>
          {rows.map(([a, b], i) => {
            const g = a !== '' && b !== '' ? gameWinner(Number(a), Number(b), ev.rules) : null;
            return (
              <div className="score-row" key={i}>
                <div className="lab" style={{ textAlign: 'right' }}>
                  第{i + 1}ゲーム
                </div>
                <input inputMode="numeric" value={a} aria-label={`第${i + 1}ゲーム ${nameA}`} onChange={(e) => setRows(rows.map((r, k) => (k === i ? [e.target.value.replace(/\D/g, ''), r[1]] : r)))} />
                <div className="muted" style={{ textAlign: 'center' }}>
                  -
                </div>
                <input inputMode="numeric" value={b} aria-label={`第${i + 1}ゲーム ${nameB}`} onChange={(e) => setRows(rows.map((r, k) => (k === i ? [r[0], e.target.value.replace(/\D/g, '')] : r)))} />
                <div className="small" style={{ color: g?.error ? 'var(--danger)' : 'var(--muted)' }}>
                  {g?.error ?? (g?.winner ? (g.winner === 'a' ? '◀' : '▶') : '')}
                </div>
              </div>
            );
          })}
          <div className="row small" style={{ marginBottom: 8 }}>
            <span className="muted">まとめて入力：</span>
            <input placeholder="例 21-15 18-21 21-19" onChange={(e) => quick(e.target.value)} style={{ flex: 1 }} />
          </div>
        </>
      )}

      {isTeam && finish !== 'walkover' && <RubberEditor state={state} match={match} rubbers={rubbers} setRubbers={setRub} decidedAt={team!.decidedAt} />}

      <div className="row" style={{ margin: '8px 0' }}>
        <label className="row small" style={{ gap: 4 }}>
          結果の種類
          <select value={finish} onChange={(e) => setFinish(e.target.value as FinishType)}>
            <option value="normal">通常</option>
            <option value="retired">途中棄権</option>
            <option value="walkover">不戦勝（試合なし）</option>
          </select>
        </label>
        {finish !== 'normal' && (
          <label className="row small" style={{ gap: 4 }}>
            勝者
            <select value={manualWinner} onChange={(e) => setManualWinner(e.target.value as Side)}>
              <option value="">選択</option>
              <option value="a">{nameA}</option>
              <option value="b">{nameB}</option>
            </select>
          </label>
        )}
      </div>

      {winner && (
        <div className="notice">
          勝者：<b>{winner === 'a' ? nameA : nameB}</b>
          {isTeam ? `（${team!.wins[0]}-${team!.wins[1]}）` : games.length ? `（${scoreText(games, winner === 'b')}）` : ''}
        </div>
      )}
      {error && <div className="notice danger">{error}</div>}

      <div className="row end" style={{ marginTop: 10 }}>
        {match.status === 'done' && (
          <button
            className="danger"
            onClick={() => {
              if (!confirm('この試合の結果を取り消しますか？')) return;
              const err = undoResult(match.id);
              if (err) setError(err);
              else onClose();
            }}
          >
            結果を取り消す
          </button>
        )}
        <span className="spacer" />
        {isTeam && match.status !== 'done' && (
          <button
            className="secondary"
            onClick={() => {
              setRubbers(match.id, judged());
              onClose();
            }}
          >
            途中保存
          </button>
        )}
        <button className="secondary" onClick={onClose}>
          キャンセル
        </button>
        <button onClick={save} disabled={!winner}>
          結果を確定
        </button>
      </div>
    </Modal>
  );
}

function RubberEditor({ state, match, rubbers, setRubbers, decidedAt }: { state: AppState; match: Match; rubbers: Rubber[]; setRubbers: (r: Rubber[]) => void; decidedAt: number }) {
  const ev = state.events.find((e) => e.id === match.eventId)!;
  const pm = playerMap(state);
  const members = (side: Side) => entryById(state, match[side])?.playerIds ?? [];
  const setR = (i: number, fn: (r: Rubber) => Rubber) => setRubbers(rubbers.map((r, k) => (k === i ? fn(r) : r)));
  return (
    <div>
      {rubbers.map((r, i) => {
        const skip = ev.stopWhenDecided && decidedAt >= 0 && i > decidedAt;
        const n = r.type === 'doubles' ? 2 : 1;
        const w = r.finish === 'normal' ? matchWinner(r.games, ev.rules) : { winner: r.winner ?? null, error: undefined };
        return (
          <div key={i} className={`rubber ${skip ? 'skip' : ''}`}>
            <div className="row" style={{ marginBottom: 4 }}>
              <b>{r.label}</b>
              {skip && <span className="tag">打ち切り</span>}
              {w.winner && <span className="tag ok">{w.winner === 'a' ? '左' : '右'}の勝ち</span>}
              {!w.winner && r.games.length > 0 && <span className="tag warn">{w.error}</span>}
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {(['a', 'b'] as Side[]).map((side) => (
                <div key={side} style={{ flex: '1 1 180px' }}>
                  {Array.from({ length: n }, (_, k) => (
                    <select
                      key={k}
                      value={r[side][k] ?? ''}
                      style={{ width: '100%', marginBottom: 2 }}
                      aria-label={`${r.label} ${side === 'a' ? '左' : '右'} 選手${k + 1}`}
                      onChange={(e) =>
                        setR(i, (x) => {
                          const list = [...x[side]];
                          list[k] = e.target.value;
                          return { ...x, [side]: list };
                        })
                      }
                    >
                      <option value="">（選手）</option>
                      {members(side).map((id) => (
                        <option key={id} value={id}>
                          {pm.get(id)?.name}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              ))}
              <div style={{ flex: '1 1 200px' }}>
                <input
                  placeholder="スコア 例 21-15 21-18"
                  defaultValue={scoreText(r.games)}
                  style={{ width: '100%' }}
                  aria-label={`${r.label} スコア`}
                  onChange={(e) => setR(i, (x) => ({ ...x, games: parseScore(e.target.value) }))}
                />
                <div className="row small" style={{ marginTop: 2, gap: 4 }}>
                  <select
                    value={r.finish === 'normal' ? '' : `${r.finish}:${r.winner}`}
                    onChange={(e) => {
                      const [f, wv] = e.target.value.split(':');
                      setR(i, (x) => ({ ...x, finish: (f || 'normal') as Rubber['finish'], winner: f ? (wv as Side) : undefined }));
                    }}
                  >
                    <option value="">通常</option>
                    <option value="retired:a">棄権（左の勝ち）</option>
                    <option value="retired:b">棄権（右の勝ち）</option>
                    <option value="walkover:a">不戦（左の勝ち）</option>
                    <option value="walkover:b">不戦（右の勝ち）</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
