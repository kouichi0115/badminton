import { useEffect, useState } from 'react';
import { useAppState, update } from '../store';
import { Empty, Field } from '../components/common';
import { callText } from '../logic/call';
import { jaVoices, speak, speechAvailable, stopSpeaking } from '../logic/speech';
import { matchRoundLabel } from '../logic/names';

const KEYS = ['コート', '番号', '種目', '回戦', 'A', 'A所属', 'B', 'B所属'];
const PRESETS = [
  'ただいまより開会式を行います。選手の皆さんはフロアにお集まりください。',
  'これより昼休みとします。午後の試合は時間通りに再開します。',
  '試合の終わった選手は、速やかに結果を本部へ報告してください。',
  'これより表彰式を行います。入賞された選手は本部前にお集まりください。',
];

export default function BroadcastPage() {
  const s = useAppState();
  const t = s.tournament;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(jaVoices());
  const [free, setFree] = useState('');
  useEffect(() => {
    if (!speechAvailable()) return;
    const h = () => setVoices(jaVoices());
    speechSynthesis.addEventListener('voiceschanged', h);
    return () => speechSynthesis.removeEventListener('voiceschanged', h);
  }, []);
  const say = (text: string) => speak(text, t.speechRate, t.voiceName);
  const active = s.matches.filter((m) => m.status === 'called' || m.status === 'playing').sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  const sample = s.matches.find((m) => m.a && m.b && m.status !== 'bye');

  return (
    <>
      {!speechAvailable() && <div className="notice warn">このブラウザは音声読み上げに対応していません。Chrome や Edge、Safari をお使いください。</div>}
      <section className="panel">
        <h2>コールの文面</h2>
        <Field label="テンプレート" hint={`使える差し込み：${KEYS.map((k) => `{${k}}`).join(' ')}（名前は、読み上げ時にふりがなを使います）`}>
          <textarea rows={3} value={t.callTemplate} onChange={(e) => update((d) => void (d.tournament.callTemplate = e.target.value))} />
        </Field>
        {sample && (
          <div className="notice">
            例：{callText(s, { ...sample, court: sample.court ?? 1 })}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="small" onClick={() => say(callText(s, { ...sample, court: sample.court ?? 1 }, true))}>
                ▶ 試しに読み上げ
              </button>
            </div>
          </div>
        )}
        <div className="grid3" style={{ marginTop: 10 }}>
          <Field label="声">
            <select value={t.voiceName} onChange={(e) => update((d) => void (d.tournament.voiceName = e.target.value))}>
              <option value="">標準</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`速さ（${t.speechRate.toFixed(1)}）`}>
            <input type="range" min={0.5} max={1.6} step={0.1} value={t.speechRate} onChange={(e) => update((d) => void (d.tournament.speechRate = Number(e.target.value)))} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <div className="row">
          <h3>コート上の試合</h3>
          <span className="spacer" />
          <button className="danger small" onClick={stopSpeaking}>
            ■ 停止
          </button>
        </div>
        {active.length === 0 ? (
          <Empty>コール済み・試合中の試合はありません。</Empty>
        ) : (
          <table className="list">
            <tbody>
              {active.map((m) => (
                <tr key={m.id}>
                  <td style={{ width: 90 }}>第{m.court}コート</td>
                  <td className="small">
                    No.{m.number} {matchRoundLabel(s, m)}
                    <br />
                    {callText(s, m)}
                  </td>
                  <td>
                    <button className="small" onClick={() => say(callText(s, m, true))}>
                      ▶ 読み上げ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h3>自由放送</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          {PRESETS.map((p) => (
            <button key={p} className="secondary small" onClick={() => setFree(p)}>
              {p.slice(0, 10)}…
            </button>
          ))}
        </div>
        <textarea rows={3} value={free} onChange={(e) => setFree(e.target.value)} placeholder="放送する文を入力" />
        <div className="row end" style={{ marginTop: 6 }}>
          <button onClick={() => free && say(free)}>▶ 読み上げ</button>
        </div>
      </section>
    </>
  );
}
