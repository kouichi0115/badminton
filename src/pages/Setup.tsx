import { useRef, useState } from 'react';
import { useAppState, update, replaceState } from '../store';
import { Field, NumInput } from '../components/common';
import { newEvent } from '../logic/defaults';
import { orderText, parseOrder } from '../logic/team';
import { download } from '../logic/csv';
import { sampleState } from '../logic/sample';
import { defaultState } from '../logic/defaults';
import type { EventFormat, TEvent } from '../types';

export default function SetupPage() {
  const s = useAppState();
  const t = s.tournament;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const setT = <K extends keyof typeof t>(k: K, v: (typeof t)[K]) => update((d) => void (d.tournament[k] = v as never));

  const backup = () => {
    const name = `${t.name || '大会'}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`;
    download(name, JSON.stringify(s, null, 1), 'application/json');
  };
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.events)) throw new Error();
      replaceState(data);
      setMsg('バックアップを読み込みました');
    } catch {
      setMsg('読み込めないファイルです');
    }
  };

  return (
    <>
      <section className="panel">
        <h2>大会情報</h2>
        <div className="grid3">
          <Field label="大会名">
            <input value={t.name} onChange={(e) => setT('name', e.target.value)} placeholder="例：第10回 市民バドミントン大会" />
          </Field>
          <Field label="開催日">
            <input type="date" value={t.date} onChange={(e) => setT('date', e.target.value)} />
          </Field>
          <Field label="会場">
            <input value={t.venue} onChange={(e) => setT('venue', e.target.value)} />
          </Field>
          <Field label="主催">
            <input value={t.organizer} onChange={(e) => setT('organizer', e.target.value)} />
          </Field>
          <Field label="コート数">
            <NumInput value={t.courts} min={1} max={60} onChange={(v) => setT('courts', Math.max(1, v))} />
          </Field>
          <Field label="開始時刻">
            <input type="time" value={t.startTime} onChange={(e) => setT('startTime', e.target.value)} />
          </Field>
          <Field label="試合間の最低休憩（分）" hint="連続出場を避ける目安">
            <NumInput value={t.restMinutes} onChange={(v) => setT('restMinutes', v)} />
          </Field>
          <Field label="1人の出場種目数の上限" hint="0 = 制限なし（重複チェックに使用）">
            <NumInput value={t.maxEventsPerPlayer} onChange={(v) => setT('maxEventsPerPlayer', v)} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <div className="row">
          <h2>種目</h2>
          <span className="spacer" />
          <button className="secondary" onClick={() => update((d) => void d.events.push(newEvent('singles')))}>
            ＋ シングルス
          </button>
          <button className="secondary" onClick={() => update((d) => void d.events.push(newEvent('doubles')))}>
            ＋ ダブルス
          </button>
          <button className="secondary" onClick={() => update((d) => void d.events.push(newEvent('team')))}>
            ＋ 団体戦
          </button>
        </div>
        {s.events.length === 0 && <p className="muted">種目を追加してください。</p>}
        {s.events.map((ev, i) => (
          <EventEditor key={ev.id} ev={ev} index={i} count={s.events.length} entryCount={s.entries.filter((e) => e.eventId === ev.id).length} hasMatches={s.matches.some((m) => m.eventId === ev.id)} />
        ))}
      </section>

      <section className="panel">
        <h2>データの保存・読み込み</h2>
        <p className="muted small">データはこのブラウザ内に自動保存されます。別のパソコンへ移す時や、念のための控えにはバックアップを使ってください。</p>
        <div className="row">
          <button onClick={backup}>バックアップを保存</button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            バックアップを読み込む
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          <span className="spacer" />
          <button
            className="secondary"
            onClick={() => (s.events.length === 0 || confirm('現在のデータをサンプルで置き換えますか？')) && replaceState(sampleState())}
          >
            サンプル大会を読み込む
          </button>
          <button className="danger" onClick={() => confirm('すべてのデータを消去しますか？（元に戻すボタンで復帰できます）') && replaceState(defaultState())}>
            新しい大会を始める
          </button>
        </div>
        {msg && <div className="notice">{msg}</div>}
      </section>
    </>
  );
}

const FORMATS: { v: EventFormat; label: string }[] = [
  { v: 'tournament', label: 'トーナメント' },
  { v: 'league', label: 'リーグ戦' },
  { v: 'league-tournament', label: '予選リーグ＋決勝トーナメント' },
];

function EventEditor({ ev, index, count, entryCount, hasMatches }: { ev: TEvent; index: number; count: number; entryCount: number; hasMatches: boolean }) {
  const set = (fn: (e: TEvent) => void) => update((d) => fn(d.events.find((x) => x.id === ev.id)!));
  const [order, setOrder] = useState(orderText(ev.rubbers));
  const typeLabel = { singles: 'シングルス', doubles: 'ダブルス', team: '団体戦' }[ev.type];
  const move = (dir: number) =>
    update((d) => {
      const j = index + dir;
      [d.events[index], d.events[j]] = [d.events[j], d.events[index]];
    });
  const remove = () => {
    if (!confirm(`「${ev.name}」とそのエントリー・試合を削除しますか？`)) return;
    update((d) => {
      d.events = d.events.filter((e) => e.id !== ev.id);
      d.entries = d.entries.filter((e) => e.eventId !== ev.id);
      d.matches = d.matches.filter((m) => m.eventId !== ev.id);
    });
  };
  return (
    <div className="panel" style={{ background: '#fafbfc' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="tag info">{typeLabel}</span>
        <input value={ev.name} onChange={(e) => set((x) => (x.name = e.target.value))} style={{ fontWeight: 700, flex: '1 1 200px' }} aria-label="種目名" />
        <span className="muted small">{entryCount} エントリー</span>
        {hasMatches && <span className="tag ok">組み合わせ済</span>}
        <button className="ghost small" disabled={index === 0} onClick={() => move(-1)} title="上へ">
          ▲
        </button>
        <button className="ghost small" disabled={index === count - 1} onClick={() => move(1)} title="下へ">
          ▼
        </button>
        <button className="danger small" onClick={remove}>
          削除
        </button>
      </div>
      <div className="grid3">
        <Field label="試合方式">
          <select value={ev.format} onChange={(e) => set((x) => (x.format = e.target.value as EventFormat))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        {ev.format !== 'tournament' && (
          <Field label="グループ数">
            <NumInput value={ev.groupCount} min={1} onChange={(v) => set((x) => (x.groupCount = Math.max(1, v)))} />
          </Field>
        )}
        {ev.format === 'league-tournament' && (
          <Field label="各グループの通過数">
            <NumInput value={ev.advancePerGroup} min={1} onChange={(v) => set((x) => (x.advancePerGroup = Math.max(1, v)))} />
          </Field>
        )}
        {ev.format !== 'league' && (
          <Field label="3位決定戦">
            <select value={ev.thirdPlace ? '1' : ''} onChange={(e) => set((x) => (x.thirdPlace = !!e.target.value))}>
              <option value="">行わない（3位2名）</option>
              <option value="1">行う</option>
            </select>
          </Field>
        )}
        <Field label="点数 / 上限点 / 勝利ゲーム数" hint="例：21点・30点上限・2ゲーム先取">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <NumInput value={ev.rules.points} min={1} style={{ width: 64 }} onChange={(v) => set((x) => (x.rules.points = v))} />
            <NumInput value={ev.rules.cap} min={1} style={{ width: 64 }} onChange={(v) => set((x) => (x.rules.cap = v))} />
            <NumInput value={ev.rules.gamesToWin} min={1} max={5} style={{ width: 56 }} onChange={(v) => set((x) => (x.rules.gamesToWin = Math.max(1, v)))} />
          </div>
        </Field>
        <Field label="1試合の目安時間（分）">
          <NumInput value={ev.estMinutes} min={1} onChange={(v) => set((x) => (x.estMinutes = v))} />
        </Field>
        <Field label="参加費（1エントリー・円）">
          <NumInput value={ev.fee} onChange={(v) => set((x) => (x.fee = v))} />
        </Field>
        {ev.type === 'team' && (
          <>
            <Field label="団体戦オーダー" hint="複=ダブルス、単=シングルス をカンマ区切り（例：複,単,複,単,単）">
              <input
                value={order}
                disabled={hasMatches}
                onChange={(e) => setOrder(e.target.value)}
                onBlur={() => {
                  const r = parseOrder(order);
                  if (r.length) set((x) => (x.rubbers = r));
                  setOrder(orderText(r.length ? r : ev.rubbers));
                }}
              />
            </Field>
            <Field label="勝敗決定後の試合">
              <select value={ev.stopWhenDecided ? '1' : ''} onChange={(e) => set((x) => (x.stopWhenDecided = !!e.target.value))}>
                <option value="1">打ち切る</option>
                <option value="">最後まで行う</option>
              </select>
            </Field>
          </>
        )}
      </div>
      {ev.type === 'team' && <p className="muted small">オーダー：{ev.rubbers.map((r) => r.label).join(' → ')}</p>}
    </div>
  );
}
