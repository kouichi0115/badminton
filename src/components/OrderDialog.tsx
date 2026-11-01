import { useState } from 'react';
import type { AppState, Match, Rubber, Side } from '../types';
import { Modal } from './common';
import { entryById, entryName, matchRoundLabel, playerMap } from '../logic/names';
import { orderWarnings } from '../logic/team';
import { setRubbers } from '../actions';

/** 団体戦のオーダー入力 */
export function OrderDialog({ state, match, onClose }: { state: AppState; match: Match; onClose: () => void }) {
  const ev = state.events.find((e) => e.id === match.eventId)!;
  const pm = playerMap(state);
  const [rubbers, setLocal] = useState<Rubber[]>(() => match.rubbers.map((r) => ({ ...r, a: [...r.a], b: [...r.b] })));
  const done = match.status === 'done';
  const team = (side: Side) => entryById(state, match[side]);
  const nameOf = (id: string) => pm.get(id)?.name ?? '?';

  const setPlayer = (i: number, side: Side, k: number, id: string) =>
    setLocal(
      rubbers.map((r, j) => {
        if (j !== i) return r;
        const list = [...r[side]];
        list[k] = id;
        return { ...r, [side]: list };
      }),
    );

  const clearSide = (side: Side) => setLocal(rubbers.map((r) => ({ ...r, [side]: [] })));

  const save = () => {
    setRubbers(
      match.id,
      rubbers.map((r) => ({ ...r, a: r.a.filter(Boolean), b: r.b.filter(Boolean) })),
    );
    onClose();
  };

  const column = (side: Side) => {
    const t = team(side);
    const members = t?.playerIds ?? [];
    const warns = orderWarnings(rubbers, side, nameOf);
    return (
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <b>{entryName(state, t, pm)}</b>
          <span className="spacer" />
          {!done && (
            <button className="ghost small" onClick={() => clearSide(side)}>
              クリア
            </button>
          )}
        </div>
        {rubbers.map((r, i) => (
          <div key={i} className="rubber">
            <div className="small muted" style={{ marginBottom: 2 }}>
              {r.label}
            </div>
            {Array.from({ length: r.type === 'doubles' ? 2 : 1 }, (_, k) => (
              <select
                key={k}
                value={r[side][k] ?? ''}
                disabled={done}
                style={{ width: '100%', marginBottom: 2 }}
                aria-label={`${entryName(state, t, pm)} ${r.label} 選手${k + 1}`}
                onChange={(e) => setPlayer(i, side, k, e.target.value)}
              >
                <option value="">（未定）</option>
                {members.map((id, n) => (
                  <option key={id} value={id}>
                    {n + 1}. {pm.get(id)?.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
        ))}
        {warns.map((w) => (
          <div key={w} className="notice warn small">
            {w}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal title={`オーダー入力　No.${match.number} ${ev.name} ${matchRoundLabel(state, match)}`} onClose={onClose} wide>
      <p className="muted small" style={{ marginTop: 0 }}>
        片方のチームだけ先に保存してもかまいません。入力したオーダーは審判用紙・オーダー用紙・結果入力に反映されます。
      </p>
      {done && <div className="notice">試合が終わっているため変更できません（結果入力から修正できます）。</div>}
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        {column('a')}
        {column('b')}
      </div>
      <div className="row end" style={{ marginTop: 10 }}>
        <button className="secondary" onClick={onClose}>
          {done ? '閉じる' : 'キャンセル'}
        </button>
        {!done && <button onClick={save}>保存</button>}
      </div>
    </Modal>
  );
}
