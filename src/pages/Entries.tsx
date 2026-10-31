import { useMemo, useState } from 'react';
import { useAppState, update } from '../store';
import { Empty, EventSelect, Field, Modal, NumInput } from '../components/common';
import { addEntries, cleanupPlayers, type EntryInput } from '../actions';
import { decodeText, download, parseCSV, toCSV } from '../logic/csv';
import { entryAffiliation, entryName, playerMap } from '../logic/names';
import type { AppState, TEvent } from '../types';

type Sub = 'entries' | 'players' | 'check' | 'fee';

export default function EntriesPage() {
  const s = useAppState();
  const [sub, setSub] = useState<Sub>('entries');
  return (
    <>
      <div className="subtabs">
        {(
          [
            ['entries', 'エントリー'],
            ['players', '選手一覧'],
            ['check', '重複チェック'],
            ['fee', '参加数・参加費'],
          ] as [Sub, string][]
        ).map(([k, l]) => (
          <button key={k} className={sub === k ? 'active' : ''} onClick={() => setSub(k)}>
            {l}
          </button>
        ))}
      </div>
      {s.events.length === 0 ? (
        <Empty>
          まず「大会設定」で種目を追加してください。<br />
          <a href="#setup">大会設定へ</a>
        </Empty>
      ) : (
        <>
          {sub === 'entries' && <EntryList />}
          {sub === 'players' && <PlayerList />}
          {sub === 'check' && <DuplicateCheck />}
          {sub === 'fee' && <FeeSummary />}
        </>
      )}
    </>
  );
}

function EntryList() {
  const s = useAppState();
  const [eventId, setEventId] = useState(s.events[0]?.id ?? '');
  const ev = s.events.find((e) => e.id === eventId) ?? s.events[0];
  const [showImport, setShowImport] = useState(false);
  const pm = playerMap(s);
  const entries = s.entries.filter((e) => e.eventId === ev.id);
  const inMatch = new Set(s.matches.filter((m) => m.eventId === ev.id).flatMap((m) => [m.a, m.b]));

  const removeEntry = (id: string) => {
    if (inMatch.has(id)) return alert('組み合わせに入っているため削除できません。先に組み合わせを解除してください。');
    update((d) => {
      d.entries = d.entries.filter((e) => e.id !== id);
      cleanupPlayers(d);
    });
  };

  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 10 }}>
        <EventSelect events={s.events} value={ev.id} onChange={setEventId} />
        <span className="muted">{entries.length} エントリー</span>
        <span className="spacer" />
        <button className="secondary" onClick={() => setShowImport(true)}>
          CSV・Excelから取込
        </button>
        <button className="secondary" onClick={() => exportEntries(s, ev)}>
          CSV出力
        </button>
      </div>
      <AddEntryForm ev={ev} />
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th className="num">No</th>
              <th>{ev.type === 'team' ? 'チーム名' : '氏名'}</th>
              <th>{ev.type === 'team' ? 'メンバー' : 'ふりがな'}</th>
              <th>所属</th>
              <th>シード</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id}>
                <td className="num">{i + 1}</td>
                <td>{entryName(s, e, pm)}</td>
                <td className="small">{ev.type === 'team' ? e.playerIds.map((id) => pm.get(id)?.name).join('、') : e.playerIds.map((id) => pm.get(id)?.kana).join('・')}</td>
                <td>{entryAffiliation(s, e, pm)}</td>
                <td>
                  <NumInput value={e.seed} style={{ width: 60 }} onChange={(v) => update((d) => void (d.entries.find((x) => x.id === e.id)!.seed = v))} />
                </td>
                <td>
                  <button className="ghost small" onClick={() => removeEntry(e.id)} title="削除">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length === 0 && <p className="muted">まだエントリーがありません。上のフォームで追加するか、CSVを取り込んでください。</p>}
      {showImport && <ImportDialog ev={ev} onClose={() => setShowImport(false)} />}
    </section>
  );
}

function AddEntryForm({ ev }: { ev: TEvent }) {
  const blank = { name: '', kana: '', affiliation: '' };
  const [p1, setP1] = useState(blank);
  const [p2, setP2] = useState(blank);
  const [team, setTeam] = useState({ name: '', affiliation: '', members: '' });
  const [seed, setSeed] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ev.type === 'team') {
      if (!team.name.trim()) return;
      const members = team.members
        .split(/\n/)
        .map((l) => l.split(/[,，\t]/).map((x) => x.trim()))
        .filter((x) => x[0])
        .map(([name, kana = '']) => ({ name, kana, affiliation: team.affiliation || team.name }));
      addEntries(ev.id, [{ teamName: team.name, players: members, seed }]);
      setTeam({ name: '', affiliation: team.affiliation, members: '' });
    } else {
      if (!p1.name.trim() || (ev.type === 'doubles' && !p2.name.trim())) return;
      addEntries(ev.id, [{ players: ev.type === 'doubles' ? [p1, { ...p2, affiliation: p2.affiliation || p1.affiliation }] : [p1], seed }]);
      setP1({ ...blank, affiliation: p1.affiliation });
      setP2({ ...blank, affiliation: p2.affiliation });
    }
    setSeed(0);
    (e.target as HTMLFormElement).querySelector('input')?.focus();
  };

  const personFields = (p: typeof blank, set: (v: typeof blank) => void, n?: number) => (
    <>
      <Field label={`氏名${n ?? ''}`}>
        <input value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} required />
      </Field>
      <Field label={`ふりがな${n ?? ''}`}>
        <input value={p.kana} onChange={(e) => set({ ...p, kana: e.target.value })} />
      </Field>
      <Field label={`所属${n ?? ''}`}>
        <input value={p.affiliation} onChange={(e) => set({ ...p, affiliation: e.target.value })} />
      </Field>
    </>
  );

  return (
    <form onSubmit={submit} className="panel" style={{ background: '#fafbfc' }}>
      <div className="grid3">
        {ev.type === 'team' ? (
          <>
            <Field label="チーム名">
              <input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} required />
            </Field>
            <Field label="所属">
              <input value={team.affiliation} onChange={(e) => setTeam({ ...team, affiliation: e.target.value })} />
            </Field>
            <Field label="メンバー（1行に1人：氏名,ふりがな）">
              <textarea rows={3} value={team.members} onChange={(e) => setTeam({ ...team, members: e.target.value })} placeholder={'山田 太郎,やまだ たろう\n鈴木 一郎,すずき いちろう'} />
            </Field>
          </>
        ) : (
          <>
            {personFields(p1, setP1, ev.type === 'doubles' ? 1 : undefined)}
            {ev.type === 'doubles' && personFields(p2, setP2, 2)}
          </>
        )}
        <Field label="シード（0=なし）">
          <NumInput value={seed} onChange={setSeed} />
        </Field>
      </div>
      <div className="row end" style={{ marginTop: 8 }}>
        <button type="submit">追加</button>
      </div>
    </form>
  );
}

function templateHeader(ev: TEvent): string[] {
  if (ev.type === 'team') return ['チーム名', '所属', 'シード', '選手1', 'ふりがな1', '選手2', 'ふりがな2', '選手3', 'ふりがな3', '選手4', 'ふりがな4', '選手5', 'ふりがな5'];
  if (ev.type === 'doubles') return ['氏名1', 'ふりがな1', '所属1', '氏名2', 'ふりがな2', '所属2', 'シード'];
  return ['氏名', 'ふりがな', '所属', 'シード'];
}

function rowsToInputs(ev: TEvent, rows: string[][]): EntryInput[] {
  if (rows.length && /氏名|チーム|名前/.test(rows[0].join(''))) rows = rows.slice(1);
  return rows
    .map((r): EntryInput | null => {
      if (ev.type === 'team') {
        const [teamName, aff, seed, ...rest] = r;
        if (!teamName) return null;
        const players = [];
        for (let i = 0; i < rest.length; i += 2) if (rest[i]) players.push({ name: rest[i], kana: rest[i + 1] ?? '', affiliation: aff || teamName });
        return { teamName, players, seed: Number(seed) || 0 };
      }
      if (ev.type === 'doubles') {
        const [n1, k1, a1, n2, k2, a2, seed] = r;
        if (!n1 || !n2) return null;
        return { players: [{ name: n1, kana: k1 ?? '', affiliation: a1 ?? '' }, { name: n2, kana: k2 ?? '', affiliation: a2 || a1 || '' }], seed: Number(seed) || 0 };
      }
      const [n, k, a, seed] = r;
      if (!n) return null;
      return { players: [{ name: n, kana: k ?? '', affiliation: a ?? '' }], seed: Number(seed) || 0 };
    })
    .filter((x): x is EntryInput => !!x);
}

function ImportDialog({ ev, onClose }: { ev: TEvent; onClose: () => void }) {
  const [text, setText] = useState('');
  const inputs = useMemo(() => rowsToInputs(ev, parseCSV(text)), [ev, text]);
  const header = templateHeader(ev);
  return (
    <Modal title={`${ev.name} に取込`} onClose={onClose} wide>
      <p className="small">
        列の並び：<b>{header.join('，')}</b>
        <br />
        Excelの表をそのまま貼り付けるか、CSVファイルを選んでください（Shift_JIS / UTF-8 どちらも可）。1行目が見出しなら自動で読み飛ばします。
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <input type="file" accept=".csv,.txt,.tsv" onChange={async (e) => e.target.files?.[0] && setText(decodeText(await e.target.files[0].arrayBuffer()))} />
        <button className="secondary small" onClick={() => download(`${ev.name}_取込用.csv`, toCSV([header]))}>
          取込用ひな形をダウンロード
        </button>
      </div>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="ここに貼り付け" />
      <p className="muted small">{inputs.length} 件を読み取りました。</p>
      {inputs.length > 0 && (
        <div className="table-wrap" style={{ maxHeight: 200 }}>
          <table className="list">
            <tbody>
              {inputs.slice(0, 50).map((x, i) => (
                <tr key={i}>
                  <td>{x.teamName}</td>
                  <td>{x.players.map((p) => `${p.name}（${p.affiliation}）`).join('・')}</td>
                  <td>{x.seed || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row end" style={{ marginTop: 10 }}>
        <button className="secondary" onClick={onClose}>
          キャンセル
        </button>
        <button
          disabled={!inputs.length}
          onClick={() => {
            addEntries(ev.id, inputs);
            onClose();
          }}
        >
          {inputs.length} 件を追加
        </button>
      </div>
    </Modal>
  );
}

function exportEntries(s: AppState, ev: TEvent) {
  const pm = playerMap(s);
  const rows: (string | number)[][] = [templateHeader(ev)];
  for (const e of s.entries.filter((x) => x.eventId === ev.id)) {
    const ps = e.playerIds.map((id) => pm.get(id)!);
    if (ev.type === 'team') rows.push([e.teamName, entryAffiliation(s, e, pm), e.seed || '', ...ps.flatMap((p) => [p.name, p.kana])]);
    else if (ev.type === 'doubles') rows.push([...ps.flatMap((p) => [p.name, p.kana, p.affiliation]), e.seed || '']);
    else rows.push([ps[0].name, ps[0].kana, ps[0].affiliation, e.seed || '']);
  }
  download(`${ev.name}_参加者.csv`, toCSV(rows));
}

function PlayerList() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const evCount = new Map<string, string[]>();
  for (const e of s.entries) for (const p of e.playerIds) evCount.set(p, [...(evCount.get(p) ?? []), s.events.find((x) => x.id === e.eventId)?.name ?? '']);
  const list = s.players
    .filter((p) => !q || (p.name + p.kana + p.affiliation).includes(q))
    .sort((a, b) => a.affiliation.localeCompare(b.affiliation, 'ja') || a.kana.localeCompare(b.kana, 'ja'));
  const set = (id: string, k: 'name' | 'kana' | 'affiliation' | 'category' | 'gender', v: string) =>
    update((d) => void ((d.players.find((p) => p.id === id)! as unknown as Record<string, string>)[k] = v));
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 10 }}>
        <input placeholder="氏名・所属で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{list.length} 人</span>
        <span className="spacer" />
        <button
          className="secondary"
          onClick={() =>
            download(
              '選手一覧.csv',
              toCSV([['氏名', 'ふりがな', '所属', '性別', '区分', '出場種目'], ...list.map((p) => [p.name, p.kana, p.affiliation, p.gender, p.category, (evCount.get(p.id) ?? []).join('・')])]),
            )
          }
        >
          CSV出力
        </button>
      </div>
      <p className="muted small">ここで直した氏名・所属は、すべての種目に反映されます。</p>
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th>氏名</th>
              <th>ふりがな</th>
              <th>所属</th>
              <th>性別</th>
              <th>区分</th>
              <th>出場種目</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <input value={p.name} onChange={(e) => set(p.id, 'name', e.target.value)} />
                </td>
                <td>
                  <input value={p.kana} onChange={(e) => set(p.id, 'kana', e.target.value)} />
                </td>
                <td>
                  <input value={p.affiliation} onChange={(e) => set(p.id, 'affiliation', e.target.value)} />
                </td>
                <td>
                  <select value={p.gender} onChange={(e) => set(p.id, 'gender', e.target.value)}>
                    <option value=""></option>
                    <option value="M">男</option>
                    <option value="F">女</option>
                  </select>
                </td>
                <td>
                  <input value={p.category} style={{ width: 80 }} onChange={(e) => set(p.id, 'category', e.target.value)} />
                </td>
                <td className="small">{(evCount.get(p.id) ?? []).join('、')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DuplicateCheck() {
  const s = useAppState();
  const pm = playerMap(s);
  const issues: { level: 'danger' | 'warn'; text: string }[] = [];
  const norm = (t: string) => t.replace(/[\s　]/g, '');

  // 同じ種目に同じ選手が2回
  for (const ev of s.events) {
    const seen = new Map<string, number>();
    for (const e of s.entries.filter((x) => x.eventId === ev.id)) for (const p of e.playerIds) seen.set(p, (seen.get(p) ?? 0) + 1);
    for (const [p, c] of seen) if (c > 1) issues.push({ level: 'danger', text: `${ev.name}：${pm.get(p)?.name}（${pm.get(p)?.affiliation}）が ${c} 回エントリーされています` });
  }
  // 出場種目数の上限
  const max = s.tournament.maxEventsPerPlayer;
  if (max > 0) {
    const cnt = new Map<string, Set<string>>();
    for (const e of s.entries) for (const p of e.playerIds) cnt.set(p, (cnt.get(p) ?? new Set()).add(e.eventId));
    for (const [p, set] of cnt)
      if (set.size > max)
        issues.push({ level: 'danger', text: `${pm.get(p)?.name}（${pm.get(p)?.affiliation}）が ${set.size} 種目に出場しています（上限 ${max}）：${[...set].map((id) => s.events.find((e) => e.id === id)?.name).join('、')}` });
  }
  // 同姓同名で所属違い
  const byName = new Map<string, typeof s.players>();
  for (const p of s.players) byName.set(norm(p.name), [...(byName.get(norm(p.name)) ?? []), p]);
  for (const [, ps] of byName) if (ps.length > 1) issues.push({ level: 'warn', text: `同じ氏名で所属が異なる選手がいます：${ps.map((p) => `${p.name}（${p.affiliation || '所属なし'}）`).join('、')}` });
  // ふりがな未入力
  const noKana = s.players.filter((p) => !p.kana).length;
  if (noKana) issues.push({ level: 'warn', text: `ふりがなが未入力の選手が ${noKana} 人います（放送の読み上げに使います）` });

  return (
    <section className="panel">
      <h3>重複・不備のチェック</h3>
      {issues.length === 0 ? <div className="notice">問題は見つかりませんでした。</div> : issues.map((x, i) => <div key={i} className={`notice ${x.level}`}>{x.text}</div>)}
    </section>
  );
}

function FeeSummary() {
  const s = useAppState();
  const pm = playerMap(s);
  const affs = new Map<string, Map<string, number>>();
  for (const e of s.entries) {
    const a = entryAffiliation(s, e, pm).split('・')[0] || '（所属なし）';
    if (!affs.has(a)) affs.set(a, new Map());
    const m = affs.get(a)!;
    m.set(e.eventId, (m.get(e.eventId) ?? 0) + 1);
  }
  const rows = [...affs.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'));
  const fee = (m: Map<string, number>) => s.events.reduce((t, ev) => t + (m.get(ev.id) ?? 0) * ev.fee, 0);
  const paid = new Set(s.tournament.paidAffiliations);
  const togglePaid = (a: string) =>
    update((d) => {
      const set = new Set(d.tournament.paidAffiliations);
      set.has(a) ? set.delete(a) : set.add(a);
      d.tournament.paidAffiliations = [...set];
    });
  const total = rows.reduce((t, [, m]) => t + fee(m), 0);
  const paidTotal = rows.filter(([a]) => paid.has(a)).reduce((t, [, m]) => t + fee(m), 0);
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3>所属別 参加数・参加費</h3>
        <span className="spacer" />
        <span>
          合計 <b>{total.toLocaleString()}</b> 円 ／ 受領済 <b>{paidTotal.toLocaleString()}</b> 円
        </span>
        <button
          className="secondary"
          onClick={() =>
            download(
              '参加費一覧.csv',
              toCSV([['所属', ...s.events.map((e) => e.name), '参加費', '受領'], ...rows.map(([a, m]) => [a, ...s.events.map((e) => m.get(e.id) ?? 0), fee(m), paid.has(a) ? '済' : ''])]),
            )
          }
        >
          CSV出力
        </button>
      </div>
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th>所属</th>
              {s.events.map((e) => (
                <th key={e.id} className="num">
                  {e.name}
                </th>
              ))}
              <th className="num">参加費</th>
              <th>受領</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, m]) => (
              <tr key={a}>
                <td>{a}</td>
                {s.events.map((e) => (
                  <td key={e.id} className="num">
                    {m.get(e.id) ?? ''}
                  </td>
                ))}
                <td className="num">{fee(m).toLocaleString()}</td>
                <td>
                  <input type="checkbox" checked={paid.has(a)} onChange={() => togglePaid(a)} aria-label={`${a} 受領`} />
                </td>
              </tr>
            ))}
            <tr>
              <th>合計</th>
              {s.events.map((e) => (
                <th key={e.id} className="num">
                  {s.entries.filter((x) => x.eventId === e.id).length}
                </th>
              ))}
              <th className="num">{total.toLocaleString()}</th>
              <th></th>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
